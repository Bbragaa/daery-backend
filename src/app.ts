import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { errorHandler } from "./middlewares/error-handler.middleware";
import { caseNotificationRouter } from "./routes/case-notification.routes";
import { healthInstitutionRouter } from "./routes/health-institution.routes";
import { userRouter } from "./routes/user.routes";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/users", userRouter);
app.use("/api/case-notifications", caseNotificationRouter);
app.use("/api/health-institutions", healthInstitutionRouter);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);

export { app };
