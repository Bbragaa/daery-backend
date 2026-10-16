import { Request, Response } from "express";
import * as authService from "../services/auth.service";

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}

export async function updateMe(req: Request, res: Response) {
  const user = await authService.updateMe(req.user!.id, req.body);
  res.status(200).json(user);
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json(user);
}
