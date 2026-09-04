import { Request, Response } from "express";
import * as userService from "../services/user.service";

export async function create(req: Request, res: Response) {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
}

export async function getAll(_req: Request, res: Response) {
  const users = await userService.getAllUsers();
  res.status(200).json(users);
}

export async function getById(req: Request, res: Response) {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json(user);
}

export async function update(req: Request, res: Response) {
  const user = await userService.updateUser(req.params.id, req.body);
  res.status(200).json(user);
}

export async function deactivate(req: Request, res: Response) {
  await userService.deactivateUser(req.params.id);
  res.status(204).send();
}
