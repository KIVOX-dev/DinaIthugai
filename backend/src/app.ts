import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { connectDB } from "./db";
import { attachUser, errorHandler, originGuard } from "./http";
import { authRouter } from "./routes/auth";
import { mediaDeliveryRouter, publicRouter } from "./routes/public";
import { adminRouter, aiRouter, articlesRouter, cronRouter, mediaRouter } from "./routes/staff";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_req, res) => {
    try {
      await connectDB();
      res.json({ ok: true, db: "up" });
    } catch {
      res.status(503).json({ ok: false, db: "down" });
    }
  });

  // Lazily connect for every request (serverless-friendly: connection is cached across invocations).
  app.use(async (_req, _res, next) => {
    try {
      await connectDB();
      next();
    } catch (e) {
      next(e);
    }
  });
  app.use(originGuard);
  app.use(attachUser);

  app.use("/api/auth", authRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/media", mediaDeliveryRouter); // GET /:id/:variant
  app.use("/api/media", mediaRouter); // POST/GET/PATCH ... (authenticated)
  app.use("/api/articles", articlesRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/cron", cronRouter);

  app.use("/api", (_req, res) => void res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
}

export default createApp();
