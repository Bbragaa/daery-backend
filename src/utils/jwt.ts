import jwt, { SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_SECRET, {
    subject: payload.sub,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

/** Retorna o payload ou `null` quando o token é inválido, expirado ou malformado. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded === "string" || typeof decoded.sub !== "string") {
      return null;
    }
    return { sub: decoded.sub, role: decoded.role as Role };
  } catch {
    return null;
  }
}
