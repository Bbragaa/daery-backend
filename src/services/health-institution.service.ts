import { HealthInstitution, InstitutionType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

interface CreateHealthInstitutionInput {
  name: string;
  cnesCode?: string;
  type: InstitutionType;
  regionId: string;
}

interface UpdateHealthInstitutionInput {
  name?: string;
  cnesCode?: string;
  type?: InstitutionType;
  regionId?: string;
}

function isForeignKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2003";
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function createHealthInstitution(
  input: CreateHealthInstitutionInput
): Promise<HealthInstitution> {
  try {
    return await prisma.healthInstitution.create({ data: input });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new AppError("Referenced region does not exist", 400);
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError("CNES code already in use", 409);
    }
    throw error;
  }
}

export async function getAllHealthInstitutions(): Promise<HealthInstitution[]> {
  return prisma.healthInstitution.findMany();
}

export async function getHealthInstitutionById(id: string): Promise<HealthInstitution> {
  const institution = await prisma.healthInstitution.findUnique({ where: { id } });
  if (!institution) {
    throw new AppError("Health institution not found", 404);
  }
  return institution;
}

export async function updateHealthInstitution(
  id: string,
  input: UpdateHealthInstitutionInput
): Promise<HealthInstitution> {
  await getHealthInstitutionById(id);

  try {
    return await prisma.healthInstitution.update({ where: { id }, data: input });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new AppError("Referenced region does not exist", 400);
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError("CNES code already in use", 409);
    }
    throw error;
  }
}

export async function deleteHealthInstitution(id: string): Promise<void> {
  await getHealthInstitutionById(id);
  await prisma.healthInstitution.delete({ where: { id } });
}
