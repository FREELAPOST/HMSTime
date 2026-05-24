import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createCheckpoint, restoreCheckpoint } from "../services/checkpointService.js";
import { verifySensitivePin } from "../services/securityService.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const checkpoints = await prisma.checkpoint.findMany({
    include: { createdBy: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json({ checkpoints });
});

router.post("/", async (req, res) => {
  const schema = z.object({ reason: z.string().trim().max(80).optional() });
  const data = schema.parse(req.body);
  const checkpoint = await createCheckpoint(req.auth!.id, data.reason || "checkpoint manual");
  res.status(201).json({ checkpoint });
});

router.post("/:id/restore", async (req, res) => {
  const schema = z.object({
    pin: z.string().regex(/^\d{4}$/),
    confirmation: z.literal("RESTAURAR")
  });
  const data = schema.parse(req.body);
  await verifySensitivePin(req.auth!.id, data.pin);
  const checkpoint = await restoreCheckpoint({ checkpointId: req.params.id, adminId: req.auth!.id });
  res.json({ checkpoint });
});

export default router;
