import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authRateLimiter } from "../middlewares/rate-limit.middleware";
import { validate } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { loginSchema, registerSchema, updateMeSchema } from "../validations/auth.validation";

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Public sign-up (citizen, health professional or institution)
 *     description: >
 *       Every account starts as CITIZEN. HEALTH_PROFESSIONAL and INSTITUTION sign-ups
 *       are created with verificationStatus PENDING and only gain their role after
 *       an ADMIN approves them via PATCH /api/users/{id}/verification.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/RegisterInput"
 *     responses:
 *       201:
 *         description: Account created; returns a token for the new session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AuthResponse"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       409:
 *         description: Email, CPF, CNPJ or professional registration already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       429:
 *         description: Too many attempts
 */
router.post("/register", authRateLimiter, validate(registerSchema), asyncHandler(authController.register));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/LoginInput"
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AuthResponse"
 *       401:
 *         description: Invalid credentials (same message for unknown email, wrong password or inactive account)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Error"
 *       429:
 *         description: Too many attempts
 */
router.post("/login", authRateLimiter, validate(loginSchema), asyncHandler(authController.login));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Current authenticated user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: The user behind the token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       401:
 *         description: Missing, invalid or expired token
 */
router.get("/me", authenticate, asyncHandler(authController.me));

/**
 * @openapi
 * /api/auth/me:
 *   patch:
 *     summary: Update the current user's own name
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, maxLength: 120 }
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/User"
 *       400:
 *         description: Validation error (only `name` is accepted)
 *       401:
 *         description: Missing, invalid or expired token
 */
router.patch("/me", authenticate, validate(updateMeSchema), asyncHandler(authController.updateMe));

export { router as authRouter };
