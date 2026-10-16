import { Request, Response } from "express";
import * as referenceDataService from "../services/reference-data.service";
import { AppError } from "../utils/AppError";
import { UFS } from "../validations/auth.validation";

export async function listDiseases(_req: Request, res: Response) {
  res.status(200).json(await referenceDataService.listDiseases());
}

export async function listRegions(req: Request, res: Response) {
  const { uf } = req.query;
  if (uf !== undefined && !(UFS as readonly string[]).includes(String(uf))) {
    throw new AppError("Invalid uf filter", 400);
  }
  res.status(200).json(await referenceDataService.listRegions(uf ? String(uf) : undefined));
}
