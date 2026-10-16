import { User } from "@prisma/client";
import { maskCpf } from "./documents";

export type SafeUser = Omit<User, "passwordHash" | "cpf"> & { cpf: string | null };

/** Remove o hash da senha e mascara o CPF de qualquer usuário devolvido pela API. */
export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, cpf, ...rest } = user;
  return { ...rest, cpf: maskCpf(cpf) };
}

/** Prisma P2002 = violação de unicidade. */
export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** Campos envolvidos numa violação de unicidade do Prisma (meta.target). */
export function uniqueConstraintTarget(error: unknown): string {
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) ? target.join(",") : String(target ?? "");
}
