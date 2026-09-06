import { Router } from "express";
import * as healthInstitutionController from "../controllers/health-institution.controller";
import { validate } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createHealthInstitutionSchema,
  updateHealthInstitutionSchema,
} from "../validations/health-institution.validation";

const router = Router();

/**
 * @openapi
 * /api/health-institutions:
 *   post:
 *     summary: Register a health institution
 *     tags: [HealthInstitutions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateHealthInstitutionInput"
 *     responses:
 *       201:
 *         description: Health institution created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/HealthInstitution"
 *       400:
 *         description: Validation error or referenced region does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: CNES code already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/",
  validate(createHealthInstitutionSchema),
  asyncHandler(healthInstitutionController.create)
);

/**
 * @openapi
 * /api/health-institutions:
 *   get:
 *     summary: List health institutions
 *     tags: [HealthInstitutions]
 *     responses:
 *       200:
 *         description: List of health institutions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/HealthInstitution"
 */
router.get("/", asyncHandler(healthInstitutionController.getAll));

/**
 * @openapi
 * /api/health-institutions/{id}:
 *   get:
 *     summary: Get a health institution by id
 *     tags: [HealthInstitutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Health institution found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/HealthInstitution"
 *       404:
 *         description: Health institution not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/:id", asyncHandler(healthInstitutionController.getById));

/**
 * @openapi
 * /api/health-institutions/{id}:
 *   patch:
 *     summary: Update a health institution
 *     tags: [HealthInstitutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/UpdateHealthInstitutionInput"
 *     responses:
 *       200:
 *         description: Health institution updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/HealthInstitution"
 *       400:
 *         description: Validation error or referenced region does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: Health institution not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: CNES code already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.patch(
  "/:id",
  validate(updateHealthInstitutionSchema),
  asyncHandler(healthInstitutionController.update)
);

/**
 * @openapi
 * /api/health-institutions/{id}:
 *   delete:
 *     summary: Delete a health institution
 *     tags: [HealthInstitutions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Health institution deleted
 *       404:
 *         description: Health institution not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:id", asyncHandler(healthInstitutionController.remove));

export { router as healthInstitutionRouter };
