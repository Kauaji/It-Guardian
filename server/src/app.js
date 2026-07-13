import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import alertRoutes from "./routes/alertRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import sectorRoutes from "./routes/sectorRoutes.js";
import segmentRoutes from "./routes/segmentRoutes.js";
import inventoryVisualMapRoutes, {
  inventoryVisualMapConnectionRoutes,
  inventoryVisualMapObjectRoutes
} from "./routes/inventoryVisualMapRoutes.js";
import serviceOrderRoutes from "./routes/serviceOrderRoutes.js";
import serviceOrderSuggestionRoutes from "./routes/serviceOrderSuggestionRoutes.js";
import serviceOrderSettingsRoutes from "./routes/serviceOrderSettingsRoutes.js";
import serviceOrderStatusRoutes from "./routes/serviceOrderStatusRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import technicianRoutes from "./routes/technicianRoutes.js";
import problemTypeRoutes from "./routes/problemTypeRoutes.js";
import priorityRuleRoutes from "./routes/priorityRuleRoutes.js";
import systemSettingsRoutes from "./routes/systemSettingsRoutes.js";
import maintenanceScriptRoutes from "./routes/maintenanceScriptRoutes.js";
import preventivePlanRoutes from "./routes/preventivePlanRoutes.js";
import preventiveAutomationRoutes from "./routes/preventiveAutomationRoutes.js";
import floorPlanRoutes from "./routes/floorPlanRoutes.js";
import scriptLogRoutes from "./routes/scriptLogRoutes.js";
import scriptValidationRoutes from "./routes/scriptValidationRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import userPreferenceRoutes from "./routes/userPreferenceRoutes.js";
import { initializeRuntime } from "./bootstrap.js";
import { getCorsOrigins, isAllowedVercelOrigin } from "./config/environment.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { requestContext } from "./middleware/requestContextMiddleware.js";
import { requireTrustedCookieOrigin } from "./middleware/csrfOriginMiddleware.js";
import { query } from "./database.js";

function buildCorsOptions() {
  const allowedOrigins = getCorsOrigins();

  return {
    credentials: true,
    origin(origin, callback) {
      const normalizedOrigin = origin?.replace(/\/$/, "");

      if (!origin || allowedOrigins.includes(normalizedOrigin) || isAllowedVercelOrigin(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      const error = new Error(`Origem nao permitida pelo CORS: ${origin}`);
      error.statusCode = 403;
      error.expose = true;
      callback(error);
    }
  };
}

export function createApp({ initializeOnRequest = false } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb", parameterLimit: 100 }));
  app.use(requestContext);
  app.use(requireTrustedCookieOrigin);
  if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

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

  app.get("/api/health", async (_req, res, next) => {
    try {
      await query("SELECT 1 AS healthy");
      res.json({
        status: "ok",
        database: "connected",
        service: "IT Guardian API",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      error.statusCode = 503;
      next(error);
    }
  });

  app.use("/api/public", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/preferences", userPreferenceRoutes);
  app.use("/api/devices", deviceRoutes);
  app.use("/api/alerts", alertRoutes);
  app.use("/api/logs", logRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/permissions", permissionRoutes);
  app.use("/api/sectors", sectorRoutes);
  app.use("/api/segments", segmentRoutes);
  app.use("/api/inventory-visual-maps", inventoryVisualMapRoutes);
  app.use("/api/inventory-visual-map-objects", inventoryVisualMapObjectRoutes);
  app.use("/api/inventory-visual-map-connections", inventoryVisualMapConnectionRoutes);
  app.use("/api/service-orders", serviceOrderRoutes);
  app.use("/api/service-order-suggestions", serviceOrderSuggestionRoutes);
  app.use("/api/service-order-settings", serviceOrderSettingsRoutes);
  app.use("/api/service-order-statuses", serviceOrderStatusRoutes);
  app.use("/api/system-settings", systemSettingsRoutes);
  app.use("/api/clients", clientRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/services", serviceRoutes);
  app.use("/api/technicians", technicianRoutes);
  app.use("/api/problem-types", problemTypeRoutes);
  app.use("/api/priority-rules", priorityRuleRoutes);
  app.use("/api/maintenance-scripts", maintenanceScriptRoutes);
  app.use("/api/preventive-plans", preventivePlanRoutes);
  app.use("/api/preventive-automation-plans", preventiveAutomationRoutes);
  app.use("/api/floor-plans", floorPlanRoutes);
  app.use("/api/script-validations", scriptValidationRoutes);
  app.use("/api/script-logs", scriptLogRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp({ initializeOnRequest: true });

export default app;
