import { CaseNotification, CaseStatus, Sex } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

interface CreateCaseNotificationInput {
  diseaseId: string;
  regionId: string;
  institutionId: string;
  reportedById: string;
  patientAgeRange: string;
  patientSex: Sex;
  status?: CaseStatus;
  notificationDate?: Date;
  symptomsOnsetDate?: Date;
}

interface UpdateCaseNotificationInput {
  diseaseId?: string;
  regionId?: string;
  institutionId?: string;
  reportedById?: string;
  patientAgeRange?: string;
  patientSex?: Sex;
  status?: CaseStatus;
  notificationDate?: Date;
  symptomsOnsetDate?: Date;
}

function isForeignKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2003";
}

export async function createCaseNotification(
  input: CreateCaseNotificationInput
): Promise<CaseNotification> {
  try {
    return await prisma.caseNotification.create({ data: input });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new AppError("Referenced disease, region, institution, or user does not exist", 400);
    }
    throw error;
  }
}

export async function getAllCaseNotifications(): Promise<CaseNotification[]> {
  return prisma.caseNotification.findMany();
}

export async function getCaseNotificationById(id: string): Promise<CaseNotification> {
  const caseNotification = await prisma.caseNotification.findUnique({ where: { id } });
  if (!caseNotification) {
    throw new AppError("Case notification not found", 404);
  }
  return caseNotification;
}

export async function updateCaseNotification(
  id: string,
  input: UpdateCaseNotificationInput
): Promise<CaseNotification> {
  await getCaseNotificationById(id);

  try {
    return await prisma.caseNotification.update({ where: { id }, data: input });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new AppError("Referenced disease, region, institution, or user does not exist", 400);
    }
    throw error;
  }
}

export async function deleteCaseNotification(id: string): Promise<void> {
  await getCaseNotificationById(id);
  await prisma.caseNotification.delete({ where: { id } });
}
