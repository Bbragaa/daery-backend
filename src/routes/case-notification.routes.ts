import { Router } from "express";
import * as caseNotificationController from "../controllers/case-notification.controller";
import { validate } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createCaseNotificationSchema,
  updateCaseNotificationSchema,
} from "../validations/case-notification.validation";

const router = Router();

/**
 * @openapi
 * /api/case-notifications:
 *   post:
 *     summary: Report a case notification
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
router.post("/", validate(createCaseNotificationSchema), asyncHandler(caseNotificationController.create));

/**
 * @openapi
 * /api/case-notifications:
 *   get:
 *     summary: List case notifications
 *     tags: [CaseNotifications]
 *     responses:
 *       200:
 *         description: List of case notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/CaseNotification"
 */
router.get("/", asyncHandler(caseNotificationController.getAll));

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
router.get("/:id", asyncHandler(caseNotificationController.getById));

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
  validate(updateCaseNotificationSchema),
  asyncHandler(caseNotificationController.update)
);

/**
 * @openapi
 * /api/case-notifications/{id}:
 *   delete:
 *     summary: Delete a case notification
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
 *         description: Case notification deleted
 *       404:
 *         description: Case notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:id", asyncHandler(caseNotificationController.remove));

export { router as caseNotificationRouter };
