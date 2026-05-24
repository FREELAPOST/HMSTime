import { Router } from "express";
import { z } from "zod";
import { Role, WorkSchedule } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import { hashPin } from "../utils/pin.js";
import { audit } from "../services/auditService.js";
import { verifySensitivePin } from "../services/securityService.js";

const router = Router();

router.use(requireAuth, requireAdmin);

function publicUser(user: {
  id: string;
  code: string;
  name: string;
  role: Role;
  dailyMinutesExpected: number;
  workSchedule: WorkSchedule;
  isActive: boolean;
  isBlocked: boolean;
  failedLoginAttempts: number;
  createdAt: Date;
  deactivatedAt: Date | null;
}) {
  return {
    id: user.id,
    code: user.code,
    name: user.name,
    role: user.role,
    dailyMinutesExpected: user.dailyMinutesExpected,
    workSchedule: user.workSchedule,
    isActive: user.isActive,
    isBlocked: user.isBlocked,
    failedLoginAttempts: user.failedLoginAttempts,
    createdAt: user.createdAt,
    deactivatedAt: user.deactivatedAt
  };
}

async function nextEmployeeCode() {
  const users = await prisma.user.findMany({
    select: { code: true },
    orderBy: { code: "desc" },
    take: 1
  });

  const max = users[0] ? Number(users[0].code) : 0;
  const next = Math.max(max + 1, 1);

  if (next > 999999) {
    throw new AppError("Limite de códigos atingido.", 500);
  }

  return String(next).padStart(6, "0");
}

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { code: "asc" }]
  });
  res.json({ users: users.map(publicUser) });
});

router.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(3),
    dailyMinutesExpected: z.coerce.number().int().min(60).max(960),
    workSchedule: z.nativeEnum(WorkSchedule)
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      code: await nextEmployeeCode(),
      name: data.name,
      role: "EMPLOYEE",
      pinHash: await hashPin("1234"),
      dailyMinutesExpected: data.dailyMinutesExpected,
      workSchedule: data.workSchedule
    }
  });

  await audit({
    actorId: req.auth!.id,
    targetUserId: user.id,
    action: "CREATE_USER",
    entity: "User",
    entityId: user.id,
    details: { code: user.code, dailyMinutesExpected: user.dailyMinutesExpected, workSchedule: user.workSchedule }
  });

  res.status(201).json({ user: publicUser(user) });
});

router.patch("/:id", async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(3).optional(),
    dailyMinutesExpected: z.coerce.number().int().min(60).max(960).optional(),
    workSchedule: z.nativeEnum(WorkSchedule).optional(),
    isActive: z.boolean().optional()
  });
  const data = schema.parse(req.body);
  const current = await prisma.user.findUnique({ where: { id: req.params.id } });

  if (!current) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  if (current.code === "000000" && data.isActive === false) {
    throw new AppError("Admin principal não pode ser desativado.", 422);
  }

  const user = await prisma.user.update({
    where: { id: current.id },
    data: {
      ...data,
      deactivatedAt: data.isActive === false ? new Date() : data.isActive === true ? null : undefined
    }
  });

  await audit({
    actorId: req.auth!.id,
    targetUserId: user.id,
    action: "UPDATE_USER",
    entity: "User",
    entityId: user.id,
    details: data
  });

  res.json({ user: publicUser(user) });
});

router.post("/:id/unblock", async (req, res) => {
  const schema = z.object({ pin: z.string().regex(/^\d{4}$/) });
  const data = schema.parse(req.body);
  await verifySensitivePin(req.auth!.id, data.pin);

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });

  if (!user) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      isBlocked: false,
      failedLoginAttempts: 0,
      pinHash: await hashPin("1234")
    }
  });

  await audit({
    actorId: req.auth!.id,
    targetUserId: updated.id,
    action: "UNBLOCK_USER",
    entity: "User",
    entityId: updated.id,
    details: { resetPin: true }
  });

  res.json({ user: publicUser(updated) });
});

export default router;
