import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        id: string;
        code: string;
        role: Role;
      };
    }
  }
}

export {};
