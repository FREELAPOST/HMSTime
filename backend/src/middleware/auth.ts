import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

type JwtPayload = {
  id: string;
  code: string;
  role: Role;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new AppError("Sessão não informada.", 401);
  }

  try {
    req.auth = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    throw new AppError("Sessão inválida ou expirada.", 401);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.auth.role !== "ADMIN") {
    throw new AppError("Acesso restrito ao administrador.", 403);
  }

  next();
}
