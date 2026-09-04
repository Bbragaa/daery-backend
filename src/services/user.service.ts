import bcrypt from "bcryptjs";
import { Role, User } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

type SafeUser = Omit<User, "passwordHash">;

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

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
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

export async function getAllUsers(): Promise<SafeUser[]> {
  const users = await prisma.user.findMany({ where: { isActive: true } });
  return users.map(toSafeUser);
}

export async function getUserById(id: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new AppError("User not found", 404);
  }
  return toSafeUser(user);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<SafeUser> {
  await getUserById(id);

  const { password, ...rest } = input;
  const data: Record<string, unknown> = { ...rest };
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

export async function deactivateUser(id: string): Promise<void> {
  await getUserById(id);
  await prisma.user.update({ where: { id }, data: { isActive: false } });
}
