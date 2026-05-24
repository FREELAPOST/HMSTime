import { prisma } from "../prisma.js";
import { AppError } from "../utils/errors.js";
import { comparePin } from "../utils/pin.js";

export async function verifySensitivePin(userId: string, pin: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.isActive || user.isBlocked) {
    throw new AppError("Usuário inválido para confirmar ação.", 403);
  }

  const valid = await comparePin(pin, user.pinHash);
  if (!valid) {
    throw new AppError("PIN de confirmação incorreto.", 403);
  }

  return user;
}
