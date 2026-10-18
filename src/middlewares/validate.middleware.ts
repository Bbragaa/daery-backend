import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../utils/AppError";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const { fieldErrors, formErrors } = result.error.flatten();
      next(new AppError("Validation failed", 400, { fieldErrors, formErrors }));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Valida a query string. O resultado (já convertido: números, datas) fica em
 * `res.locals.query`, porque `req.query` é recalculado pelo Express a cada acesso.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const { fieldErrors, formErrors } = result.error.flatten();
      next(new AppError("Invalid query parameters", 400, { fieldErrors, formErrors }));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}
