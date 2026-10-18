import { Router } from "express";
import * as referenceDataController from "../controllers/reference-data.controller";
import { asyncHandler } from "../utils/asyncHandler";

// Dados de referência públicos: alimentam os filtros e o mapa da Home 1, que funciona sem login.

const diseaseRouter = Router();

/**
 * @openapi
 * /api/diseases:
 *   get:
 *     summary: List monitored diseases (public)
 *     tags: [Reference data]
 *     security: []
 *     responses:
 *       200:
 *         description: Diseases ordered by name
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Disease"
 */
diseaseRouter.get("/", asyncHandler(referenceDataController.listDiseases));

const regionRouter = Router();

/**
 * @openapi
 * /api/regions:
 *   get:
 *     summary: List municipalities with coordinates (public)
 *     tags: [Reference data]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: uf
 *         schema:
 *           type: string
 *           example: GO
 *     responses:
 *       200:
 *         description: Municipalities ordered by state and name
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Region"
 *       400:
 *         description: Invalid uf filter
 */
regionRouter.get("/", asyncHandler(referenceDataController.listRegions));

export { diseaseRouter, regionRouter };
