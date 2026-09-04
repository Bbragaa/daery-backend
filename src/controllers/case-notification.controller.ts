import { Request, Response } from "express";
import * as caseNotificationService from "../services/case-notification.service";

export async function create(req: Request, res: Response) {
  const caseNotification = await caseNotificationService.createCaseNotification(req.body);
  res.status(201).json(caseNotification);
}

export async function getAll(_req: Request, res: Response) {
  const caseNotifications = await caseNotificationService.getAllCaseNotifications();
  res.status(200).json(caseNotifications);
}

export async function getById(req: Request, res: Response) {
  const caseNotification = await caseNotificationService.getCaseNotificationById(req.params.id);
  res.status(200).json(caseNotification);
}

export async function update(req: Request, res: Response) {
  const caseNotification = await caseNotificationService.updateCaseNotification(
    req.params.id,
    req.body
  );
  res.status(200).json(caseNotification);
}

export async function remove(req: Request, res: Response) {
  await caseNotificationService.deleteCaseNotification(req.params.id);
  res.status(204).send();
}
