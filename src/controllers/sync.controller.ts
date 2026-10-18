import { Request, Response } from "express";
import { env } from "../config/env";
import { getSyncStatus, startSync } from "../services/sync-runner.service";

export async function syncInfoDengueNow(req: Request, res: Response) {
  const weeks: number = req.body?.weeks ?? env.INFODENGUE_SYNC_WEEKS;
  if (!startSync(weeks, "manual")) {
    res.status(409).json({ error: "A synchronization is already running", status: getSyncStatus() });
    return;
  }
  // 202: aceita e em andamento. O resultado sai em GET /api/sync/infodengue/status.
  res.status(202).json(getSyncStatus());
}

export async function syncStatus(_req: Request, res: Response) {
  res.status(200).json(getSyncStatus());
}
