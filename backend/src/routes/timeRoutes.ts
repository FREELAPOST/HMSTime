import { Router } from "express";
import { z } from "zod";
import { AdjustmentKind, EntryType } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import {
  approveAdjustment,
  createAdminEntry,
  createEmployeeAdjustment,
  deleteAdminEntry,
  getAdminOverview,
  getDaySummary,
  getMonthBalance,
  punch,
  rejectAdjustment,
  updateAdminEntry
} from "../services/timeService.js";
import { formatDateKey, formatMonthKey } from "../utils/date.js";

const router = Router();

router.use(requireAuth);

router.get("/me/day", async (req, res) => {
  const date = String(req.query.date ?? formatDateKey(new Date()));
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
  if (!user) throw new AppError("Usuário não encontrado.", 404);
  res.json(await getDaySummary(user, date));
});

router.get("/me/month", async (req, res) => {
  const month = String(req.query.month ?? formatMonthKey(new Date()));
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });
  if (!user) throw new AppError("Usuário não encontrado.", 404);
  res.json(await getMonthBalance(user, month));
});

router.post("/me/punch", async (req, res) => {
  const schema = z.object({ type: z.nativeEnum(EntryType) });
  const data = schema.parse(req.body);
  const entry = await punch(req.auth!.id, data.type);
  res.status(201).json({ entry });
});

router.post("/me/adjustments", async (req, res) => {
  const schema = z.object({
    kind: z.nativeEnum(AdjustmentKind),
    entryId: z.string().optional(),
    type: z.nativeEnum(EntryType).optional(),
    occurredAt: z.string().optional(),
    pin: z.string().regex(/^\d{4}$/),
    reason: z.string().trim().min(1).max(50)
  });
  const request = await createEmployeeAdjustment({
    userId: req.auth!.id,
    ...schema.parse(req.body)
  });
  res.status(201).json({ request });
});

router.get("/admin/overview", requireAdmin, async (req, res) => {
  const date = String(req.query.date ?? formatDateKey(new Date()));
  const month = String(req.query.month ?? formatMonthKey(new Date()));
  res.json(await getAdminOverview(date, month));
});

router.get("/admin/adjustments", requireAdmin, async (_req, res) => {
  const requests = await prisma.timeAdjustmentRequest.findMany({
    include: {
      user: { select: { id: true, code: true, name: true } },
      reviewedBy: { select: { id: true, code: true, name: true } }
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
  res.json({ requests });
});

router.post("/admin/entries", requireAdmin, async (req, res) => {
  const schema = z.object({
    userId: z.string(),
    type: z.nativeEnum(EntryType),
    occurredAt: z.string(),
    pin: z.string().regex(/^\d{4}$/),
    reason: z.string().trim().max(50).optional()
  });
  const entry = await createAdminEntry({ adminId: req.auth!.id, ...schema.parse(req.body) });
  res.status(201).json({ entry });
});

router.patch("/admin/entries/:id", requireAdmin, async (req, res) => {
  const schema = z.object({
    type: z.nativeEnum(EntryType),
    occurredAt: z.string(),
    pin: z.string().regex(/^\d{4}$/),
    reason: z.string().trim().max(50).optional()
  });
  const entry = await updateAdminEntry({ adminId: req.auth!.id, entryId: req.params.id, ...schema.parse(req.body) });
  res.json({ entry });
});

router.delete("/admin/entries/:id", requireAdmin, async (req, res) => {
  const schema = z.object({
    pin: z.string().regex(/^\d{4}$/),
    reason: z.string().trim().max(50).optional()
  });
  const entry = await deleteAdminEntry({ adminId: req.auth!.id, entryId: req.params.id, ...schema.parse(req.body) });
  res.json({ entry });
});

router.post("/admin/adjustments/:id/approve", requireAdmin, async (req, res) => {
  const schema = z.object({ pin: z.string().regex(/^\d{4}$/) });
  const request = await approveAdjustment({ adminId: req.auth!.id, requestId: req.params.id, ...schema.parse(req.body) });
  res.json({ request });
});

router.post("/admin/adjustments/:id/reject", requireAdmin, async (req, res) => {
  const schema = z.object({
    pin: z.string().regex(/^\d{4}$/),
    rejectionReason: z.string().trim().max(120).optional()
  });
  const request = await rejectAdjustment({ adminId: req.auth!.id, requestId: req.params.id, ...schema.parse(req.body) });
  res.json({ request });
});

export default router;
