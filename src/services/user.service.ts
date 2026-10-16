import bcrypt from "bcryptjs";
import { Role, VerificationStatus } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { isUniqueConstraintError, SafeUser, toSafeUser } from "../utils/safe-user";

export type { SafeUser };

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
}

interface UserListFilter {
  verificationStatus?: VerificationStatus;
}

// Perfis que, no cadastro público, dependem de aprovação (decisão D3).
const VERIFIED_ROLES: Role[] = ["HEALTH_PROFESSIONAL", "INSTITUTION"];

/**
 * Campos de verificação coerentes com o perfil definido diretamente por um ADMIN.
 * Profissional ou instituição: o ADMIN responde pela verificação (APPROVED).
 * Demais perfis: não há verificação pendente nem pedido de perfil.
 * Sem isso, um CITIZEN com pedido PENDING promovido à mão continuaria aparecendo
 * na fila de aprovação, e um rebaixado manteria APPROVED.
 */
function roleFields(role: Role) {
  return VERIFIED_ROLES.includes(role)
    ? { role, requestedRole: role, verificationStatus: "APPROVED" as const }
    : { role, requestedRole: null, verificationStatus: "NOT_REQUIRED" as const };
}

export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        ...(input.role ? roleFields(input.role) : {}),
      },
    });
    return toSafeUser(user);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("Email already in use", 409);
    }
    throw error;
  }
}

export async function getAllUsers(filter: UserListFilter = {}): Promise<SafeUser[]> {
  const where = filter.verificationStatus
    ? { isActive: true, verificationStatus: filter.verificationStatus }
    : { isActive: true };
  const users = await prisma.user.findMany({ where });
  return users.map(toSafeUser);
}

export async function getUserById(id: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new AppError("User not found", 404);
  }
  return toSafeUser(user);
}

/**
 * `actorId` é o ADMIN que faz a alteração. Ele não pode mudar o próprio perfil: isso evita
 * que o sistema fique sem nenhum ADMIN (outro ADMIN sempre continua ativo para corrigir).
 */
export async function updateUser(id: string, input: UpdateUserInput, actorId?: string): Promise<SafeUser> {
  const current = await getUserById(id);

  const { password, role, ...rest } = input;
  const roleChanged = role !== undefined && role !== current.role;
  if (roleChanged && id === actorId) {
    throw new AppError("You cannot change your own role", 409);
  }

  const data: Record<string, unknown> = { ...rest, ...(roleChanged ? roleFields(role) : {}) };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  }

  try {
    const user = await prisma.user.update({ where: { id }, data });
    return toSafeUser(user);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("Email already in use", 409);
    }
    throw error;
  }
}

/** Um ADMIN não pode desativar a própria conta (ver `updateUser`). */
export async function deactivateUser(id: string, actorId?: string): Promise<void> {
  if (id === actorId) {
    throw new AppError("You cannot deactivate your own account", 409);
  }
  await getUserById(id);
  await prisma.user.update({ where: { id }, data: { isActive: false } });
}

/**
 * Decisão do ADMIN sobre um cadastro de profissional de saúde ou instituição (decisão D3).
 * Aprovado: o perfil pedido passa a valer. Recusado: a conta continua como CITIZEN.
 */
export async function reviewVerification(
  id: string,
  decision: "APPROVED" | "REJECTED"
): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new AppError("User not found", 404);
  }
  if (user.verificationStatus !== "PENDING" || !user.requestedRole) {
    throw new AppError("User has no pending verification", 409);
  }

  const data =
    decision === "APPROVED"
      ? { verificationStatus: "APPROVED" as const, role: user.requestedRole }
      : { verificationStatus: "REJECTED" as const };

  const updated = await prisma.user.update({ where: { id }, data });
  return toSafeUser(updated);
}
