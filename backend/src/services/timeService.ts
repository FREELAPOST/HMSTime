import {
  AdjustmentKind,
  EntrySource,
  EntryStatus,
  EntryType,
  Prisma,
  type TimeAdjustmentRequest,
  type TimeEntry,
  type User
} from "@prisma/client";
import { prisma } from "../prisma.js";
import { audit } from "./auditService.js";
import { verifySensitivePin } from "./securityService.js";
import {
  eachDayOfMonth,
  endOfDay,
  formatDateKey,
  formatMonthKey,
  isSameLocalDay,
  minutesBetween,
  parseDateKey,
  parseMonthKey
} from "../utils/date.js";
import { AppError } from "../utils/errors.js";
import { getExpectedMinutesForDate, getHolidaysBetween } from "./holidayService.js";

type AdjustmentLike = Pick<
  TimeAdjustmentRequest,
  | "id"
  | "userId"
  | "kind"
  | "entryId"
  | "requestedType"
  | "requestedOccurredAt"
  | "reason"
  | "status"
  | "createdAt"
> & {
  originalSnapshot?: Prisma.JsonValue | null;
  proposedSnapshot?: Prisma.JsonValue | null;
};

export type TimelineItem = {
  id: string;
  entryId?: string;
  adjustmentId?: string;
  type: EntryType;
  occurredAt: Date;
  status: EntryStatus;
  source: EntrySource;
  reason?: string | null;
  isEdited: boolean;
  isVirtual: boolean;
  affectsTotals: boolean;
  adjustmentKind?: AdjustmentKind;
  note?: string;
};

export type DaySummary = {
  date: string;
  entries: TimelineItem[];
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
};

function assertReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed || trimmed.length > 50) {
    throw new AppError("Justificativa obrigatória com no máximo 50 caracteres.", 422);
  }
  return trimmed;
}

function assertEntryDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Data/hora inválida.", 422);
  }
}

function entryToTimeline(entry: TimeEntry): TimelineItem {
  return {
    id: entry.id,
    entryId: entry.id,
    type: entry.type,
    occurredAt: entry.occurredAt,
    status: entry.status,
    source: entry.source,
    reason: entry.reason,
    isEdited: entry.isEdited,
    isVirtual: false,
    affectsTotals: entry.status === "APPROVED"
  };
}

function requestToVirtualItem(request: AdjustmentLike, original?: TimelineItem): TimelineItem | null {
  if (request.kind === "DELETE") {
    if (!original) return null;
    return {
      ...original,
      id: `request-${request.id}`,
      adjustmentId: request.id,
      entryId: original.entryId,
      status: request.status === "REJECTED" ? "REJECTED" : "PENDING",
      source: "ADJUSTMENT",
      reason: request.reason,
      isEdited: true,
      isVirtual: true,
      affectsTotals: false,
      adjustmentKind: "DELETE",
      note: request.status === "REJECTED" ? "Exclusão rejeitada" : "Exclusão pendente"
    };
  }

  if (!request.requestedType || !request.requestedOccurredAt) {
    return null;
  }

  return {
    id: `request-${request.id}`,
    adjustmentId: request.id,
    entryId: request.entryId ?? undefined,
    type: request.requestedType,
    occurredAt: request.requestedOccurredAt,
    status: request.status === "REJECTED" ? "REJECTED" : "PENDING",
    source: "ADJUSTMENT",
    reason: request.reason,
    isEdited: true,
    isVirtual: true,
    affectsTotals: request.status === "PENDING",
    adjustmentKind: request.kind,
    note: request.kind === "CREATE" ? "Lançamento manual" : "Edição manual"
  };
}

function withinRange(item: TimelineItem, start?: Date, end?: Date) {
  if (start && item.occurredAt < start) return false;
  if (end && item.occurredAt > end) return false;
  return true;
}

function sortTimeline(items: TimelineItem[]) {
  return [...items].sort((a, b) => {
    const byDate = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (byDate !== 0) return byDate;
    if (a.type === b.type) return a.id.localeCompare(b.id);
    return a.type === "IN" ? -1 : 1;
  });
}

export async function buildTimeline(
  userId: string,
  options: {
    start?: Date;
    end?: Date;
    includeRejectedDisplay?: boolean;
    extraRequests?: AdjustmentLike[];
    extraItems?: TimelineItem[];
  } = {}
) {
  const statuses: EntryStatus[] = options.includeRejectedDisplay ? ["APPROVED", "REJECTED"] : ["APPROVED"];
  const entries = await prisma.timeEntry.findMany({
    where: { userId, status: { in: statuses } },
    orderBy: { occurredAt: "asc" }
  });

  const requests = await prisma.timeAdjustmentRequest.findMany({
    where: {
      userId,
      status: {
        in: options.includeRejectedDisplay ? ["PENDING", "REJECTED"] : ["PENDING"]
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const allRequests = [...requests, ...(options.extraRequests ?? [])];
  const byEntryId = new Map(entries.map((entry) => [entry.id, entryToTimeline(entry)]));
  const timeline = new Map<string, TimelineItem>();

  for (const item of byEntryId.values()) {
    timeline.set(item.id, item);
  }

  for (const request of allRequests) {
    const original = request.entryId ? byEntryId.get(request.entryId) : undefined;

    if (request.status === "PENDING" && request.entryId && (request.kind === "UPDATE" || request.kind === "DELETE")) {
      timeline.delete(request.entryId);
    }

    const virtual = requestToVirtualItem(request, original);
    if (virtual) {
      timeline.set(virtual.id, virtual);
    }
  }

  for (const item of options.extraItems ?? []) {
    timeline.set(item.id, item);
  }

  return sortTimeline([...timeline.values()].filter((item) => withinRange(item, options.start, options.end)));
}

export function calculateWorkedMinutes(items: TimelineItem[]) {
  const effective = sortTimeline(
    items.filter((item) => item.affectsTotals && (item.status === "APPROVED" || item.status === "PENDING"))
  );

  let startedAt: Date | null = null;
  let total = 0;

  for (const item of effective) {
    if (item.type === "IN") {
      startedAt = item.occurredAt;
      continue;
    }

    if (item.type === "OUT" && startedAt) {
      total += minutesBetween(startedAt, item.occurredAt);
      startedAt = null;
    }
  }

  return total;
}

export function assertCoherentTimeline(items: TimelineItem[]) {
  const effective = sortTimeline(
    items.filter((item) => item.affectsTotals && (item.status === "APPROVED" || item.status === "PENDING"))
  );

  let previous: TimelineItem | null = null;

  for (const item of effective) {
    if (!previous) {
      if (item.type !== "IN") {
        throw new AppError("A linha do tempo deve começar com uma entrada.", 422);
      }
      previous = item;
      continue;
    }

    if (previous.type === item.type) {
      const label = item.type === "IN" ? "entrada" : "saída";
      throw new AppError(`Não é permitido registrar duas ${label}s seguidas.`, 422);
    }

    previous = item;
  }
}

export async function getDaySummary(user: User, dateKey: string): Promise<DaySummary> {
  const start = parseDateKey(dateKey);
  const end = endOfDay(start);
  const entries = await buildTimeline(user.id, { start, end, includeRejectedDisplay: true });
  const holidays = await getHolidaysBetween(start, end);
  const workedMinutes = calculateWorkedMinutes(entries);
  const expectedMinutes = getExpectedMinutesForDate(user, start, holidays);

  return {
    date: dateKey,
    entries,
    workedMinutes,
    expectedMinutes,
    balanceMinutes: workedMinutes - expectedMinutes
  };
}

export async function getMonthBalance(user: User, monthKey: string) {
  const { start, end } = parseMonthKey(monthKey);
  const entries = await buildTimeline(user.id, { start, end, includeRejectedDisplay: false });
  const holidays = await getHolidaysBetween(start, end);
  const workedMinutes = calculateWorkedMinutes(entries);
  const expectedDays = eachDayOfMonth(monthKey).filter((day) => getExpectedMinutesForDate(user, day, holidays) > 0).length;
  const expectedMinutes = expectedDays * user.dailyMinutesExpected;

  return {
    month: monthKey,
    workedMinutes,
    expectedMinutes,
    balanceMinutes: workedMinutes - expectedMinutes,
    expectedDays
  };
}

export async function getMonthlyDays(user: User, monthKey: string) {
  const { start, end } = parseMonthKey(monthKey);
  const monthEntries = await buildTimeline(user.id, { start, end, includeRejectedDisplay: true });
  const holidays = await getHolidaysBetween(start, end);

  return eachDayOfMonth(monthKey).map((day) => {
    const date = formatDateKey(day);
    const entries = monthEntries.filter((entry) => formatDateKey(entry.occurredAt) === date);
    const workedMinutes = calculateWorkedMinutes(entries);
    const expectedMinutes = getExpectedMinutesForDate(user, day, holidays);

    return {
      date,
      entries,
      workedMinutes,
      expectedMinutes,
      balanceMinutes: workedMinutes - expectedMinutes
    };
  });
}

export async function punch(userId: string, type: EntryType) {
  const now = new Date();
  const all = await buildTimeline(userId, { includeRejectedDisplay: false });
  const effective = all.filter((item) => item.affectsTotals);
  const last = effective.at(-1);

  if (type === "IN" && last?.type === "IN") {
    if (!isSameLocalDay(last.occurredAt, now)) {
      throw new AppError("Existe entrada aberta em dia anterior. Lance uma saída manual retroativa para continuar.", 409);
    }

    throw new AppError("Já existe uma entrada aberta. Registre uma saída antes de nova entrada.", 409);
  }

  if (type === "OUT" && last?.type !== "IN") {
    throw new AppError("Não existe entrada aberta para registrar saída.", 409);
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      type,
      occurredAt: now,
      source: "AUTO",
      status: "APPROVED",
      createdById: userId
    }
  });

  await audit({
    actorId: userId,
    targetUserId: userId,
    action: "PUNCH",
    entity: "TimeEntry",
    entityId: entry.id,
    details: { type, occurredAt: now.toISOString() }
  });

  return entry;
}

function snapshotEntry(entry: TimeEntry) {
  return {
    id: entry.id,
    type: entry.type,
    occurredAt: entry.occurredAt.toISOString(),
    status: entry.status,
    source: entry.source,
    reason: entry.reason,
    isEdited: entry.isEdited
  };
}

async function assertNoPendingForEntry(entryId: string) {
  const pending = await prisma.timeAdjustmentRequest.findFirst({
    where: {
      entryId,
      status: "PENDING"
    }
  });

  if (pending) {
    throw new AppError("Já existe pendência para este registro.", 409);
  }
}

function allowsTemporaryManualEntryDraft(kind: AdjustmentKind, type: EntryType | null, occurredAt: Date | null) {
  if (kind !== "CREATE" || type !== "IN" || !occurredAt) {
    return false;
  }

  return formatDateKey(occurredAt) < formatDateKey(new Date());
}

function assertCoherentAdjustmentTimeline(
  items: TimelineItem[],
  kind: AdjustmentKind,
  type: EntryType | null,
  occurredAt: Date | null
) {
  try {
    assertCoherentTimeline(items);
  } catch (error) {
    if (error instanceof AppError && allowsTemporaryManualEntryDraft(kind, type, occurredAt)) {
      return;
    }

    throw error;
  }
}

export async function createEmployeeAdjustment(input: {
  userId: string;
  pin: string;
  kind: AdjustmentKind;
  entryId?: string;
  type?: EntryType;
  occurredAt?: string;
  reason: string;
}) {
  await verifySensitivePin(input.userId, input.pin);
  const reason = assertReason(input.reason);
  let entry: TimeEntry | null = null;
  let requestedType: EntryType | null = input.type ?? null;
  let requestedOccurredAt: Date | null = input.occurredAt ? new Date(input.occurredAt) : null;

  if (input.kind !== "CREATE") {
    if (!input.entryId) {
      throw new AppError("Registro original não informado.", 422);
    }

    entry = await prisma.timeEntry.findFirst({
      where: { id: input.entryId, userId: input.userId, status: "APPROVED" }
    });

    if (!entry) {
      throw new AppError("Registro original não encontrado.", 404);
    }

    await assertNoPendingForEntry(entry.id);
  }

  if (input.kind === "UPDATE") {
    requestedType = input.type ?? entry?.type ?? null;
    requestedOccurredAt = input.occurredAt ? new Date(input.occurredAt) : entry?.occurredAt ?? null;
  }

  if (input.kind === "CREATE" || input.kind === "UPDATE") {
    if (!requestedType || !requestedOccurredAt) {
      throw new AppError("Tipo e data/hora são obrigatórios.", 422);
    }
    assertEntryDate(requestedOccurredAt);
  }

  const candidate: AdjustmentLike = {
    id: `candidate-${Date.now()}`,
    userId: input.userId,
    kind: input.kind,
    entryId: entry?.id ?? input.entryId ?? null,
    requestedType,
    requestedOccurredAt,
    originalSnapshot: entry ? snapshotEntry(entry) : null,
    proposedSnapshot:
      requestedType && requestedOccurredAt
        ? { type: requestedType, occurredAt: requestedOccurredAt.toISOString(), reason }
        : null,
    reason,
    status: "PENDING",
    createdAt: new Date()
  };

  const simulated = await buildTimeline(input.userId, {
    includeRejectedDisplay: false,
    extraRequests: [candidate]
  });
  assertCoherentAdjustmentTimeline(simulated, input.kind, requestedType, requestedOccurredAt);

  const request = await prisma.timeAdjustmentRequest.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      entryId: entry?.id ?? null,
      requestedType,
      requestedOccurredAt,
      originalSnapshot: entry ? snapshotEntry(entry) : undefined,
      proposedSnapshot:
        requestedType && requestedOccurredAt
          ? { type: requestedType, occurredAt: requestedOccurredAt.toISOString(), reason }
          : undefined,
      reason,
      status: "PENDING"
    }
  });

  await audit({
    actorId: input.userId,
    targetUserId: input.userId,
    action: "REQUEST_ADJUSTMENT",
    entity: "TimeAdjustmentRequest",
    entityId: request.id,
    details: { kind: input.kind, reason }
  });

  return request;
}

export async function createAdminEntry(input: {
  adminId: string;
  pin: string;
  userId: string;
  type: EntryType;
  occurredAt: string;
  reason?: string;
}) {
  await verifySensitivePin(input.adminId, input.pin);
  const occurredAt = new Date(input.occurredAt);
  assertEntryDate(occurredAt);

  const extra: TimelineItem = {
    id: `candidate-${Date.now()}`,
    type: input.type,
    occurredAt,
    status: "APPROVED",
    source: "MANUAL_ADMIN",
    reason: input.reason?.trim() || null,
    isEdited: false,
    isVirtual: true,
    affectsTotals: true
  };

  const simulated = await buildTimeline(input.userId, { includeRejectedDisplay: false, extraItems: [extra] });
  try {
    assertCoherentTimeline(simulated);
  } catch (error) {
    if (!(error instanceof AppError) || !allowsTemporaryManualEntryDraft("CREATE", input.type, occurredAt)) {
      throw error;
    }
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId: input.userId,
      type: input.type,
      occurredAt,
      source: "MANUAL_ADMIN",
      status: "APPROVED",
      reason: input.reason?.trim() || null,
      createdById: input.adminId
    }
  });

  await audit({
    actorId: input.adminId,
    targetUserId: input.userId,
    action: "ADMIN_CREATE_ENTRY",
    entity: "TimeEntry",
    entityId: entry.id,
    details: snapshotEntry(entry)
  });

  return entry;
}

export async function updateAdminEntry(input: {
  adminId: string;
  pin: string;
  entryId: string;
  type: EntryType;
  occurredAt: string;
  reason?: string;
}) {
  await verifySensitivePin(input.adminId, input.pin);
  const entry = await prisma.timeEntry.findUnique({ where: { id: input.entryId } });

  if (!entry || entry.status !== "APPROVED") {
    throw new AppError("Registro não encontrado para edição.", 404);
  }

  await assertNoPendingForEntry(entry.id);

  const occurredAt = new Date(input.occurredAt);
  assertEntryDate(occurredAt);

  const base = await buildTimeline(entry.userId, { includeRejectedDisplay: false });
  const simulated = base
    .filter((item) => item.entryId !== entry.id)
    .concat({
      id: entry.id,
      entryId: entry.id,
      type: input.type,
      occurredAt,
      status: "APPROVED",
      source: "MANUAL_ADMIN",
      reason: input.reason?.trim() || null,
      isEdited: true,
      isVirtual: false,
      affectsTotals: true
    });
  assertCoherentTimeline(simulated);

  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      type: input.type,
      occurredAt,
      source: "MANUAL_ADMIN",
      reason: input.reason?.trim() || null,
      isEdited: true,
      updatedById: input.adminId
    }
  });

  await audit({
    actorId: input.adminId,
    targetUserId: entry.userId,
    action: "ADMIN_UPDATE_ENTRY",
    entity: "TimeEntry",
    entityId: entry.id,
    details: { before: snapshotEntry(entry), after: snapshotEntry(updated) }
  });

  return updated;
}

export async function deleteAdminEntry(input: {
  adminId: string;
  pin: string;
  entryId: string;
  reason?: string;
}) {
  await verifySensitivePin(input.adminId, input.pin);
  const entry = await prisma.timeEntry.findUnique({ where: { id: input.entryId } });

  if (!entry || entry.status !== "APPROVED") {
    throw new AppError("Registro não encontrado para exclusão.", 404);
  }

  await assertNoPendingForEntry(entry.id);

  const base = await buildTimeline(entry.userId, { includeRejectedDisplay: false });
  const simulated = base.filter((item) => item.entryId !== entry.id);
  assertCoherentTimeline(simulated);

  const deleted = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      status: "REJECTED",
      reason: input.reason?.trim() || entry.reason,
      isEdited: true,
      updatedById: input.adminId
    }
  });

  await audit({
    actorId: input.adminId,
    targetUserId: entry.userId,
    action: "ADMIN_DELETE_ENTRY",
    entity: "TimeEntry",
    entityId: entry.id,
    details: { before: snapshotEntry(entry), reason: input.reason }
  });

  return deleted;
}

export async function approveAdjustment(input: { adminId: string; pin: string; requestId: string }) {
  await verifySensitivePin(input.adminId, input.pin);
  const request = await prisma.timeAdjustmentRequest.findUnique({
    where: { id: input.requestId },
    include: { entry: true }
  });

  if (!request || request.status !== "PENDING") {
    throw new AppError("Pendência não encontrada.", 404);
  }

  let entityId: string | null = request.entryId;

  await prisma.$transaction(async (tx) => {
    if (request.kind === "CREATE") {
      if (!request.requestedType || !request.requestedOccurredAt) {
        throw new AppError("Pendência inválida.", 422);
      }

      const created = await tx.timeEntry.create({
        data: {
          userId: request.userId,
          type: request.requestedType,
          occurredAt: request.requestedOccurredAt,
          source: "MANUAL_EMPLOYEE",
          status: "APPROVED",
          reason: request.reason,
          isEdited: true,
          createdById: request.userId,
          updatedById: input.adminId
        }
      });
      entityId = created.id;
    }

    if (request.kind === "UPDATE") {
      if (!request.entryId || !request.requestedType || !request.requestedOccurredAt) {
        throw new AppError("Pendência inválida.", 422);
      }

      await tx.timeEntry.update({
        where: { id: request.entryId },
        data: {
          type: request.requestedType,
          occurredAt: request.requestedOccurredAt,
          source: "ADJUSTMENT",
          reason: request.reason,
          isEdited: true,
          updatedById: input.adminId
        }
      });
    }

    if (request.kind === "DELETE") {
      if (!request.entryId) {
        throw new AppError("Pendência inválida.", 422);
      }

      await tx.timeEntry.update({
        where: { id: request.entryId },
        data: {
          status: "REJECTED",
          source: "ADJUSTMENT",
          reason: request.reason,
          isEdited: true,
          updatedById: input.adminId
        }
      });
    }

    await tx.timeAdjustmentRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedById: input.adminId,
        reviewedAt: new Date()
      }
    });
  });

  await audit({
    actorId: input.adminId,
    targetUserId: request.userId,
    action: "APPROVE_ADJUSTMENT",
    entity: "TimeAdjustmentRequest",
    entityId: request.id,
    details: { kind: request.kind, entryId: entityId }
  });

  return prisma.timeAdjustmentRequest.findUnique({ where: { id: request.id } });
}

export async function rejectAdjustment(input: {
  adminId: string;
  pin: string;
  requestId: string;
  rejectionReason?: string;
}) {
  await verifySensitivePin(input.adminId, input.pin);
  const request = await prisma.timeAdjustmentRequest.findUnique({ where: { id: input.requestId } });

  if (!request || request.status !== "PENDING") {
    throw new AppError("Pendência não encontrada.", 404);
  }

  const updated = await prisma.timeAdjustmentRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      rejectionReason: input.rejectionReason?.trim() || null,
      reviewedById: input.adminId,
      reviewedAt: new Date()
    }
  });

  await audit({
    actorId: input.adminId,
    targetUserId: request.userId,
    action: "REJECT_ADJUSTMENT",
    entity: "TimeAdjustmentRequest",
    entityId: request.id,
    details: { kind: request.kind, rejectionReason: input.rejectionReason }
  });

  return updated;
}

export async function getAdminOverview(dateKey = formatDateKey(new Date()), monthKey = formatMonthKey(new Date())) {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { code: "asc" }]
  });

  const rows = await Promise.all(
    users.map(async (user) => ({
      user,
      day: await getDaySummary(user, dateKey),
      month: await getMonthBalance(user, monthKey)
    }))
  );

  const pending = await prisma.timeAdjustmentRequest.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "asc" }
  });

  return { date: dateKey, month: monthKey, rows, pending };
}
