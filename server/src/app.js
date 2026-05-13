import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import segmentRoutes from "./routes/segmentRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "IT Guardian API",
      timestamp: new Date().toISOString()
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/devices", deviceRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/logs", logRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/segments", segmentRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
