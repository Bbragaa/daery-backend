import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { errorHandler } from "./middlewares/error-handler.middleware";
import { authRouter } from "./routes/auth.routes";
import { caseNotificationRouter } from "./routes/case-notification.routes";
import { diseaseRouter, regionRouter } from "./routes/reference-data.routes";
import { alertRouter, epidemiologicalDataRouter } from "./routes/epidemiological-data.routes";
import { syncRouter } from "./routes/sync.routes";
import { userRouter } from "./routes/user.routes";

const app = express();

// Atrás de um proxy reverso, req.ip passa a ser o IP real do cliente (usado pelo rate limit).
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

// Swagger UI fica antes do helmet: a política CSP padrão do helmet bloqueia os
// recursos da página de documentação. As rotas da API recebem todos os cabeçalhos.
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/case-notifications", caseNotificationRouter);
app.use("/api/diseases", diseaseRouter);
app.use("/api/regions", regionRouter);
app.use("/api/sync", syncRouter);
app.use("/api/epidemiological-data", epidemiologicalDataRouter);
app.use("/api/alerts", alertRouter);

app.use(errorHandler);

export { app };
