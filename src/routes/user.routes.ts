import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { createUserSchema, updateUserSchema } from "../validations/user.validation";

const router = Router();

router.post("/", validate(createUserSchema), asyncHandler(userController.create));
router.get("/", asyncHandler(userController.getAll));
router.get("/:id", asyncHandler(userController.getById));
router.patch("/:id", validate(updateUserSchema), asyncHandler(userController.update));
router.delete("/:id", asyncHandler(userController.deactivate));

export { router as userRouter };
