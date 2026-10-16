import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import "../types/auth";
import { AppError } from "../utils/AppError";
import { verifyToken } from "../utils/jwt";

/**
 * Exige um token Bearer válido. O usuário é relido do banco a cada requisição,
 * para que desativação e mudança de perfil (aprovação pelo ADMIN) valham na hora,
 * sem esperar o token expirar.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const payload = verifyToken(header.slice("Bearer ".length).trim());
    if (!payload) {
      throw new AppError("Invalid or expired token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, verificationStatus: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new AppError("Invalid or expired token", 401);
    }

    req.user = { id: user.id, role: user.role, verificationStatus: user.verificationStatus };
    next();
  } catch (error) {
    next(error);
  }
}

/** Deve ser usado depois de `authenticate`. Libera apenas os perfis informados. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError("You do not have permission to perform this action", 403));
      return;
    }
    next();
  };
}

/**
 * Para rotas públicas que mostram mais detalhes a perfis autorizados: identifica o usuário
 * quando há um token válido, mas nunca bloqueia. Token ausente, inválido ou de conta
 * desativada é tratado como visitante anônimo.
 */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      const payload = verifyToken(header.slice("Bearer ".length).trim());
      if (payload) {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, verificationStatus: true, isActive: true },
        });
        if (user?.isActive) {
          req.user = { id: user.id, role: user.role, verificationStatus: user.verificationStatus };
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}
