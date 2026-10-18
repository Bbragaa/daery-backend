import { Request, Response } from "express";
import { VerificationStatus } from "@prisma/client";
import * as userService from "../services/user.service";
import { AppError } from "../utils/AppError";

const VERIFICATION_STATUSES = ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"];

export async function create(req: Request, res: Response) {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
}

export async function getAll(req: Request, res: Response) {
  const { verificationStatus } = req.query;
  if (verificationStatus !== undefined && !VERIFICATION_STATUSES.includes(String(verificationStatus))) {
    throw new AppError("Invalid verificationStatus filter", 400);
  }
  const users = await userService.getAllUsers(
    verificationStatus ? { verificationStatus: verificationStatus as VerificationStatus } : {}
  );
  res.status(200).json(users);
}

export async function getById(req: Request, res: Response) {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json(user);
}

export async function update(req: Request, res: Response) {
  const user = await userService.updateUser(req.params.id, req.body, req.user!.id);
  res.status(200).json(user);
}

export async function deactivate(req: Request, res: Response) {
  await userService.deactivateUser(req.params.id, req.user!.id);
  res.status(204).send();
}

export async function reviewVerification(req: Request, res: Response) {
  const user = await userService.reviewVerification(req.params.id, req.body.decision);
  res.status(200).json(user);
}
