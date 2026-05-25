import "express-async-errors";
import express from "express";
import cors from "cors";
import path from "node:path";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import timeRoutes from "./routes/timeRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import checkpointRoutes from "./routes/checkpointRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL === "*" ? true : env.FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/time", timeRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/checkpoints", checkpointRoutes);
app.use("/api/holidays", holidayRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
