import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";
import { comparePin, hashPin } from "../utils/pin.js";
import { audit } from "../services/auditService.js";

const router = Router();

const loginSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  pin: z.string().regex(/^\d{4}$/)
});

router.post("/login", async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { code: data.code } });

  if (!user) {
    throw new AppError("Código ou PIN inválido.", 401);
  }

  if (!user.isActive) {
    throw new AppError("Usuário desativado.", 403);
  }

  if (user.isBlocked) {
    throw new AppError("Usuário bloqueado. Solicite desbloqueio ao administrador.", 403);
  }

  const validPin = await comparePin(data.pin, user.pinHash);

  if (!validPin) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        isBlocked: attempts >= 5
      }
    });

    if (attempts >= 5) {
      await audit({
        actorId: user.id,
        targetUserId: user.id,
        action: "USER_BLOCKED",
        entity: "User",
        entityId: user.id,
        details: { reason: "5 tentativas de PIN inválido" }
      });
      throw new AppError("Usuário bloqueado após 5 tentativas incorretas.", 403);
    }

    throw new AppError("Código ou PIN inválido.", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0 }
  });

  const token = signToken({ id: user.id, code: user.code, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      code: user.code,
      name: user.name,
      role: user.role,
      dailyMinutesExpected: user.dailyMinutesExpected,
      workSchedule: user.workSchedule
    }
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.id },
    select: {
      id: true,
      code: true,
      name: true,
      role: true,
      dailyMinutesExpected: true,
      workSchedule: true,
      isActive: true,
      isBlocked: true
    }
  });

  if (!user || !user.isActive || user.isBlocked) {
    throw new AppError("Usuário sem acesso.", 403);
  }

  res.json({ user });
});

router.post("/change-pin", requireAuth, async (req, res) => {
  const schema = z.object({
    currentPin: z.string().regex(/^\d{4}$/),
    newPin: z.string().regex(/^\d{4}$/)
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id } });

  if (!user) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  const valid = await comparePin(data.currentPin, user.pinHash);
  if (!valid) {
    throw new AppError("PIN atual incorreto.", 403);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { pinHash: await hashPin(data.newPin) }
  });

  await audit({
    actorId: user.id,
    targetUserId: user.id,
    action: "CHANGE_PIN",
    entity: "User",
    entityId: user.id
  });

  res.json({ ok: true });
});

export default router;
