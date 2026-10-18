import { Router } from "express";
import * as caseNotificationController from "../controllers/case-notification.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validate, validateQuery } from "../middlewares/validate.middleware";
import { caseNotificationListQuerySchema } from "../validations/epidemiological-data.validation";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createCaseNotificationSchema,
  updateCaseNotificationSchema,
} from "../validations/case-notification.validation";

const router = Router();

router.use(authenticate);

// Dados de caso são restritos a perfis profissionais (decisão D2).
const canRead = authorize("HEALTH_PROFESSIONAL", "INSTITUTION", "RESEARCHER", "ADMIN");
const canReport = authorize("HEALTH_PROFESSIONAL", "INSTITUTION");
const canUpdate = authorize("HEALTH_PROFESSIONAL", "INSTITUTION", "ADMIN");

/**
 * @openapi
 * /api/case-notifications:
 *   post:
 *     summary: Report a case notification (HEALTH_PROFESSIONAL or INSTITUTION; author taken from the token)
 *     tags: [CaseNotifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateCaseNotificationInput"
 *     responses:
 *       201:
 *         description: Case notification created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/CaseNotification"
 *       400:
 *         description: Validation error or referenced disease/region/user does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post(
  "/",
  canReport,
  validate(createCaseNotificationSchema),
  asyncHandler(caseNotificationController.create)
);

/**
 * @openapi
 * /api/case-notifications:
 *   get:
 *     summary: List case notifications (paginated, newest first)
 *     tags: [CaseNotifications]
 *     parameters:
 *       - { in: query, name: diseaseId, schema: { type: string, format: uuid } }
 *       - { in: query, name: regionId, schema: { type: string, format: uuid } }
 *       - { in: query, name: uf, schema: { type: string, example: GO } }
 *       - { in: query, name: status, schema: { $ref: "#/components/schemas/CaseStatus" } }
 *       - { in: query, name: startDate, schema: { type: string, format: date } }
 *       - { in: query, name: endDate, schema: { type: string, format: date } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *     responses:
 *       200:
 *         description: One page of case notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/CaseNotification"
 *                 page: { type: integer }
 *                 pageSize: { type: integer }
 *                 total: { type: integer }
 *       400:
 *         description: Invalid query parameters
 */
router.get(
  "/",
  canRead,
  validateQuery(caseNotificationListQuerySchema),
  asyncHandler(caseNotificationController.getAll)
);

/**
 * @openapi
 * /api/case-notifications/{id}:
 *   get:
 *     summary: Get a case notification by id
 *     tags: [CaseNotifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Case notification found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/CaseNotification"
 *       404:
 *         description: Case notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/:id", canRead, asyncHandler(caseNotificationController.getById));

/**
 * @openapi
 * /api/case-notifications/{id}:
 *   patch:
 *     summary: Update a case notification
 *     tags: [CaseNotifications]
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
 *             $ref: "#/components/schemas/UpdateCaseNotificationInput"
 *     responses:
 *       200:
 *         description: Case notification updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/CaseNotification"
 *       400:
 *         description: Validation error or referenced disease/region/user does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: Case notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.patch(
  "/:id",
  canUpdate,
  validate(updateCaseNotificationSchema),
  asyncHandler(caseNotificationController.update)
);

/**
 * @openapi
 * /api/case-notifications/{id}:
 *   delete:
 *     summary: Soft-delete a case notification (ADMIN only)
 *     tags: [CaseNotifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Case notification marked as deleted (deletedAt set)
 *       404:
 *         description: Case notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:id", authorize("ADMIN"), asyncHandler(caseNotificationController.remove));

export { router as caseNotificationRouter };
