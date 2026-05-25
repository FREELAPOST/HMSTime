import path from "node:path";
import { mkdirSync } from "node:fs";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { audit } from "../services/auditService.js";

const router = Router();
const uploadDir = process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? "/tmp/uploads"
  : path.join(process.cwd(), "uploads");

mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `company-logo${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype));
  }
});

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const company = await prisma.companySettings.upsert({
    where: { id: "company" },
    update: {},
    create: { id: "company" }
  });
  res.json({ company });
});

router.patch("/", requireAdmin, async (req, res) => {
  const schema = z.object({
    legalName: z.string().trim().max(160),
    cnpj: z.string().trim().max(24),
    address: z.string().trim().max(240)
  });
  const data = schema.parse(req.body);
  const company = await prisma.companySettings.upsert({
    where: { id: "company" },
    update: data,
    create: { id: "company", ...data }
  });

  await audit({
    actorId: req.auth!.id,
    action: "UPDATE_COMPANY_SETTINGS",
    entity: "CompanySettings",
    entityId: "company",
    details: data
  });

  res.json({ company });
});

router.post("/logo", requireAdmin, upload.single("logo"), async (req, res) => {
  const logoPath = req.file ? `/uploads/${req.file.filename}` : null;
  const company = await prisma.companySettings.upsert({
    where: { id: "company" },
    update: { logoPath },
    create: { id: "company", logoPath }
  });

  await audit({
    actorId: req.auth!.id,
    action: "UPDATE_COMPANY_LOGO",
    entity: "CompanySettings",
    entityId: "company",
    details: { logoPath }
  });

  res.json({ company });
});

export default router;
