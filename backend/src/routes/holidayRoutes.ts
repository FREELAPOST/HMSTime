import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createHoliday, deleteHoliday, listHolidays } from "../services/holidayService.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (req, res) => {
  const holidays = await listHolidays({
    month: req.query.month ? String(req.query.month) : undefined,
    startDate: req.query.startDate ? String(req.query.startDate) : undefined,
    endDate: req.query.endDate ? String(req.query.endDate) : undefined
  });

  res.json({ holidays });
});

router.post("/", async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string().trim().min(1).max(80),
    note: z.string().trim().max(160).optional()
  });
  const data = schema.parse(req.body);
  const holiday = await createHoliday({
    actorId: req.auth!.id,
    ...data
  });

  res.status(201).json({ holiday });
});

router.delete("/:id", async (req, res) => {
  const holiday = await deleteHoliday({
    actorId: req.auth!.id,
    id: req.params.id
  });

  res.json({ holiday });
});

export default router;
