import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3333),
  JWT_SECRET: z.string().min(12).default("troque-este-segredo-local"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  NODE_ENV: z.string().default("development")
});

export const env = envSchema.parse(process.env);
