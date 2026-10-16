import { Router } from "express";
import { z } from "zod";
import * as syncController from "../controllers/sync.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

const syncSchema = z.object({ weeks: z.number().int().min(1).max(52).optional() }).strict();

/**
 * @openapi
 * /api/sync/infodengue:
 *   post:
 *     summary: Start pulling the latest epidemiological weeks from InfoDengue (ADMIN only)
 *     description: >
 *       For every municipality with an IBGE code and every disease covered by InfoDengue,
 *       fetches the last `weeks` epidemiological weeks and upserts them as EpidemiologicalRecord.
 *       Idempotent. Runs in the background because it can take minutes: the response returns
 *       right away and the result is read from GET /api/sync/infodengue/status.
 *       Only one synchronization runs at a time (manual or scheduled).
 *     tags: [Sync]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weeks:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 52
 *                 description: Defaults to INFODENGUE_SYNC_WEEKS
 *     responses:
 *       202:
 *         description: Synchronization started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SyncStatus"
 *       409:
 *         description: A synchronization is already running
 * /api/sync/infodengue/status:
 *   get:
 *     summary: Progress of the running synchronization and report of the last one (ADMIN only)
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Current status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SyncStatus"
 */
router.post(
  "/infodengue",
  authenticate,
  authorize("ADMIN"),
  validate(syncSchema),
  asyncHandler(syncController.syncInfoDengueNow)
);

router.get("/infodengue/status", authenticate, authorize("ADMIN"), asyncHandler(syncController.syncStatus));

export { router as syncRouter };
