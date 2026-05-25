import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { formatDateKey } from "../utils/date.js";
import { AppError } from "../utils/errors.js";
import { audit } from "./auditService.js";

const checkpointDir = path.join(process.cwd(), "checkpoints");

async function snapshotData() {
  const [users, timeEntries, adjustmentRequests, auditLogs, companySettings, holidays, checkpoints, appSettings] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.timeEntry.findMany(),
      prisma.timeAdjustmentRequest.findMany(),
      prisma.auditLog.findMany(),
      prisma.companySettings.findMany(),
      prisma.holiday.findMany(),
      prisma.checkpoint.findMany(),
      prisma.appSetting.findMany()
    ]);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    tables: {
      users,
      timeEntries,
      adjustmentRequests,
      auditLogs,
      companySettings,
      holidays,
      checkpoints,
      appSettings
    }
  };
}

export async function createCheckpoint(createdById?: string | null, reason = "checkpoint manual") {
  await mkdir(checkpointDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `checkpoint-${stamp}.json`;
  const filePath = path.join(checkpointDir, fileName);

  await writeFile(filePath, JSON.stringify(await snapshotData(), null, 2), "utf-8");

  const checkpoint = await prisma.checkpoint.create({
    data: {
      fileName,
      filePath,
      reason,
      createdById: createdById ?? null
    }
  });

  await audit({
    actorId: createdById ?? null,
    action: "CREATE_CHECKPOINT",
    entity: "Checkpoint",
    entityId: checkpoint.id,
    details: { reason }
  });

  return checkpoint;
}

export async function restoreCheckpoint(input: { checkpointId: string; adminId: string }) {
  const checkpoint = await prisma.checkpoint.findUnique({ where: { id: input.checkpointId } });

  if (!checkpoint) {
    throw new AppError("Checkpoint não encontrado.", 404);
  }

  const raw = await readFile(checkpoint.filePath, "utf-8");
  const snapshot = JSON.parse(raw) as Awaited<ReturnType<typeof snapshotData>>;

  if (snapshot.version !== 1) {
    throw new AppError("Versão de checkpoint incompatível.", 422);
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.timeAdjustmentRequest.deleteMany();
    await tx.timeEntry.deleteMany();
    await tx.checkpoint.deleteMany();
    await tx.appSetting.deleteMany();
    await tx.holiday.deleteMany();
    await tx.companySettings.deleteMany();
    await tx.user.deleteMany();

    if (snapshot.tables.users.length) await tx.user.createMany({ data: snapshot.tables.users });
    if (snapshot.tables.timeEntries.length) await tx.timeEntry.createMany({ data: snapshot.tables.timeEntries });
    if (snapshot.tables.adjustmentRequests.length) {
      await tx.timeAdjustmentRequest.createMany({ data: snapshot.tables.adjustmentRequests });
    }
    if (snapshot.tables.companySettings.length) {
      await tx.companySettings.createMany({ data: snapshot.tables.companySettings });
    }
    if (snapshot.tables.holidays?.length) await tx.holiday.createMany({ data: snapshot.tables.holidays });
    if (snapshot.tables.checkpoints.length) await tx.checkpoint.createMany({ data: snapshot.tables.checkpoints });
    if (snapshot.tables.appSettings.length) await tx.appSetting.createMany({ data: snapshot.tables.appSettings });
    if (snapshot.tables.auditLogs.length) await tx.auditLog.createMany({ data: snapshot.tables.auditLogs });
  });

  await audit({
    actorId: input.adminId,
    action: "RESTORE_CHECKPOINT",
    entity: "Checkpoint",
    entityId: checkpoint.id,
    details: { fileName: checkpoint.fileName }
  });

  return checkpoint;
}

export async function ensureDailyCheckpoint() {
  const today = formatDateKey(new Date());
  const key = "lastDailyCheckpoint";
  const setting = await prisma.appSetting.findUnique({ where: { key } });

  if (setting?.value === today) {
    return null;
  }

  const checkpoint = await createCheckpoint(null, "checkpoint automatico diario");
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: today },
    update: { value: today }
  });

  return checkpoint;
}
