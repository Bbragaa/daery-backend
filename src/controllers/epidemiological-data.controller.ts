import { Role } from "@prisma/client";
import { Request, Response } from "express";
import * as epidemiologicalDataService from "../services/epidemiological-data.service";

// Perfis que veem as contagens de casos reportados no Daery sem supressão (os mesmos da Home 2).
const FULL_REPORTS_ROLES: Role[] = ["HEALTH_PROFESSIONAL", "INSTITUTION", "RESEARCHER", "ADMIN"];

export async function summary(req: Request, res: Response) {
  const fullPlatformReports = !!req.user && FULL_REPORTS_ROLES.includes(req.user.role);
  // A resposta depende do token: caches intermediários não podem servi-la a outro usuário.
  res.setHeader("Vary", "Authorization");
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json(await epidemiologicalDataService.getSummary(res.locals.query, { fullPlatformReports }));
}

export async function alerts(_req: Request, res: Response) {
  res.status(200).json(await epidemiologicalDataService.getAlerts(res.locals.query));
}
