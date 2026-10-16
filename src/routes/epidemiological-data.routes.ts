import { Router } from "express";
import * as epidemiologicalDataController from "../controllers/epidemiological-data.controller";
import { optionalAuthenticate } from "../middlewares/auth.middleware";
import { validateQuery } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { alertsQuerySchema, summaryQuerySchema } from "../validations/epidemiological-data.validation";

// Rotas públicas: só dados agregados por município, nunca dados de paciente (RNE002).

const epidemiologicalDataRouter = Router();

/**
 * @openapi
 * /api/epidemiological-data/summary:
 *   get:
 *     summary: Cases per municipality × disease in a period, with map coordinates and severity (public)
 *     description: >
 *       Aggregates EpidemiologicalRecord (InfoDengue and other sources) and the case notifications
 *       reported in Daery. Severity comes from the most recent InfoDengue alert level in the period
 *       (1 LOW, 2 MEDIUM, 3 HIGH, 4 CRITICAL); it is null when there is no alert level.
 *       Without dates, the period is the last 8 weeks up to today (maximum 366 days).
 *     tags: [Epidemiological data]
 *     security: []
 *     parameters:
 *       - { in: query, name: diseaseId, schema: { type: string, format: uuid } }
 *       - { in: query, name: regionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: uf, schema: { type: string, example: GO } }
 *       - { in: query, name: startDate, schema: { type: string, format: date, example: "2026-08-01" } }
 *       - { in: query, name: endDate, schema: { type: string, format: date, example: "2026-10-09" } }
 *     responses:
 *       200:
 *         description: Summary ordered by severity, then by cases
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SummaryResponse"
 *       400:
 *         description: Invalid query parameters
 */
epidemiologicalDataRouter.get(
  "/summary",
  optionalAuthenticate,
  validateQuery(summaryQuerySchema),
  asyncHandler(epidemiologicalDataController.summary)
);

const alertRouter = Router();

/**
 * @openapi
 * /api/alerts:
 *   get:
 *     summary: Current preventive alerts per municipality (public)
 *     description: >
 *       For each municipality × disease, takes the most recent InfoDengue week within `weeks`
 *       and returns an alert when its level is at least `minLevel` (default 3, sustained
 *       transmission). Includes general prevention recommendations.
 *     tags: [Epidemiological data]
 *     security: []
 *     parameters:
 *       - { in: query, name: diseaseId, schema: { type: string, format: uuid } }
 *       - { in: query, name: regionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: uf, schema: { type: string, example: GO } }
 *       - { in: query, name: minLevel, schema: { type: integer, minimum: 1, maximum: 4, default: 3 } }
 *       - { in: query, name: weeks, schema: { type: integer, minimum: 1, maximum: 12, default: 4 } }
 *     responses:
 *       200:
 *         description: Alerts, most severe first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Alert"
 *       400:
 *         description: Invalid query parameters
 */
alertRouter.get("/", validateQuery(alertsQuerySchema), asyncHandler(epidemiologicalDataController.alerts));

export { alertRouter, epidemiologicalDataRouter };
