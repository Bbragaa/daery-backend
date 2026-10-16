import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      err.details === undefined ? { error: err.message } : { error: err.message, details: err.details }
    );
    return;
  }

  // Erros lançados pelo express.json() (JSON malformado ou corpo grande demais).
  const bodyError = err as { type?: string; status?: number };
  if (bodyError?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }
  if (bodyError?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
