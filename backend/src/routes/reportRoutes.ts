import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { buildMonthlyReport, buildPeriodReport } from "../services/reportService.js";
import { generateMonthlyReportPdf } from "../services/pdfService.js";
import { formatMonthKey } from "../utils/date.js";

const router = Router();

router.use(requireAuth);

router.get("/month", async (req, res) => {
  const report = await buildMonthlyReport({
    requesterId: req.auth!.id,
    requesterRole: req.auth!.role,
    month: String(req.query.month ?? formatMonthKey(new Date())),
    userId: req.query.userId ? String(req.query.userId) : undefined
  });
  res.json(report);
});

router.get("/month/pdf", async (req, res) => {
  const report = await buildMonthlyReport({
    requesterId: req.auth!.id,
    requesterRole: req.auth!.role,
    month: String(req.query.month ?? formatMonthKey(new Date())),
    userId: req.query.userId ? String(req.query.userId) : undefined
  });
  const pdf = await generateMonthlyReportPdf(report);
  const suffix = req.query.userId && req.query.userId !== "all" ? String(req.query.userId) : "geral";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="relatorio-${report.month}-${suffix}.pdf"`);
  res.send(pdf);
});

router.get("/period", async (req, res) => {
  const startDate = String(req.query.startDate);
  const endDate = String(req.query.endDate);
  const report = await buildPeriodReport({
    requesterId: req.auth!.id,
    requesterRole: req.auth!.role,
    startDate,
    endDate,
    userId: req.query.userId ? String(req.query.userId) : undefined
  });
  res.json(report);
});

router.get("/period/pdf", async (req, res) => {
  const startDate = String(req.query.startDate);
  const endDate = String(req.query.endDate);
  const report = await buildPeriodReport({
    requesterId: req.auth!.id,
    requesterRole: req.auth!.role,
    startDate,
    endDate,
    userId: req.query.userId ? String(req.query.userId) : undefined
  });
  const pdf = await generateMonthlyReportPdf(report);
  const suffix = req.query.userId && req.query.userId !== "all" ? String(req.query.userId) : "geral";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="relatorio-periodo-${suffix}.pdf"`);
  res.send(pdf);
});

export default router;
