import { Request, Response } from "express";
import * as healthInstitutionService from "../services/health-institution.service";

export async function create(req: Request, res: Response) {
  const institution = await healthInstitutionService.createHealthInstitution(req.body);
  res.status(201).json(institution);
}

export async function getAll(_req: Request, res: Response) {
  const institutions = await healthInstitutionService.getAllHealthInstitutions();
  res.status(200).json(institutions);
}

export async function getById(req: Request, res: Response) {
  const institution = await healthInstitutionService.getHealthInstitutionById(req.params.id);
  res.status(200).json(institution);
}

export async function update(req: Request, res: Response) {
  const institution = await healthInstitutionService.updateHealthInstitution(req.params.id, req.body);
  res.status(200).json(institution);
}

export async function remove(req: Request, res: Response) {
  await healthInstitutionService.deleteHealthInstitution(req.params.id);
  res.status(204).send();
}
