import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createUserSchema,
  reviewVerificationSchema,
  updateUserSchema,
} from "../validations/user.validation";

const router = Router();

// Toda a gestão de usuários é exclusiva de ADMIN.
router.use(authenticate, authorize("ADMIN"));

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateUserInput"
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Email already in use, or an ADMIN tried to change their own role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.post("/", validate(createUserSchema), asyncHandler(userController.create));

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List active users
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: verificationStatus
 *         schema:
 *           $ref: "#/components/schemas/VerificationStatus"
 *         description: Ex. PENDING lista os cadastros aguardando aprovação
 *     responses:
 *       200:
 *         description: List of active users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/User"
 */
router.get("/", asyncHandler(userController.getAll));

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by id
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.get("/:id", asyncHandler(userController.getById));

/**
 * @openapi
 * /api/users/{id}:
 *   patch:
 *     summary: Update a user
 *     description: >
 *       Changing `role` also sets the verification fields: HEALTH_PROFESSIONAL and INSTITUTION
 *       become APPROVED (the ADMIN vouches for them); other roles get NOT_REQUIRED and no
 *       requestedRole. An ADMIN cannot change their own role.
 *     tags: [Users]
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
 *             $ref: "#/components/schemas/UpdateUserInput"
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Email already in use, or an ADMIN tried to change their own role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.patch("/:id", validate(updateUserSchema), asyncHandler(userController.update));

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Deactivate a user (soft delete)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: User deactivated
 *       409:
 *         description: An ADMIN cannot deactivate their own account
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 */
router.delete("/:id", asyncHandler(userController.deactivate));

/**
 * @openapi
 * /api/users/{id}/verification:
 *   patch:
 *     summary: Approve or reject a pending professional/institution registration
 *     tags: [Users]
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
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Decision applied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       404:
 *         description: User not found
 *       409:
 *         description: User has no pending verification
 */
router.patch(
  "/:id/verification",
  validate(reviewVerificationSchema),
  asyncHandler(userController.reviewVerification)
);

export { router as userRouter };
