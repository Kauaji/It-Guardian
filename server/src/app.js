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
import { initializeRuntime } from "./bootstrap.js";
import { getCorsOrigins, isAllowedVercelOrigin } from "./config/environment.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

function buildCorsOptions() {
  const allowedOrigins = getCorsOrigins();

  return {
    origin(origin, callback) {
      const normalizedOrigin = origin?.replace(/\/$/, "");

      if (!origin || allowedOrigins.includes(normalizedOrigin) || isAllowedVercelOrigin(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
    }
  };
}

export function createApp({ initializeOnRequest = false } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  if (initializeOnRequest) {
    app.use(async (_req, _res, next) => {
      try {
        await initializeRuntime();
        next();
      } catch (error) {
        next(error);
      }
    });
  }

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

const app = createApp({ initializeOnRequest: true });

export default app;
