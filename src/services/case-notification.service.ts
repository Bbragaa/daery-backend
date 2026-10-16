import { CaseNotification, CaseStatus, Sex } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AuthUser } from "../types/auth";
import { CaseNotificationListQuery } from "../validations/epidemiological-data.validation";
import { AppError } from "../utils/AppError";

interface CreateCaseNotificationInput {
  diseaseId: string;
  regionId: string;
  patientAgeRange: string;
  patientSex: Sex;
  status?: CaseStatus;
  notificationDate?: Date;
  symptomsOnsetDate?: Date;
}

type UpdateCaseNotificationInput = Partial<CreateCaseNotificationInput>;

function isForeignKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2003";
}

/** O autor (`reportedById`) vem sempre do usuário autenticado, nunca do corpo da requisição. */
export async function createCaseNotification(
  input: CreateCaseNotificationInput,
  reportedById: string
): Promise<CaseNotification> {
  try {
    return await prisma.caseNotification.create({ data: { ...input, reportedById } });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new AppError("Referenced disease, region, or user does not exist", 400);
    }
    throw error;
  }
}

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lista paginada, mais recentes primeiro, com filtros por doença, local, status e período. */
export async function getAllCaseNotifications(
  query: CaseNotificationListQuery = { page: 1, pageSize: 20 }
): Promise<Page<CaseNotification>> {
  const notificationDate =
    query.startDate || query.endDate
      ? {
          ...(query.startDate ? { gte: query.startDate } : {}),
          // endDate é inclusivo: vai até o fim do dia.
          ...(query.endDate ? { lt: new Date(query.endDate.getTime() + DAY_MS) } : {}),
        }
      : undefined;

  const where = {
    deletedAt: null,
    ...(query.diseaseId ? { diseaseId: query.diseaseId } : {}),
    ...(query.regionId ? { regionId: query.regionId } : {}),
    ...(query.uf ? { region: { uf: query.uf } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(notificationDate ? { notificationDate } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.caseNotification.findMany({
      where,
      orderBy: { notificationDate: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.caseNotification.count({ where }),
  ]);

  return { data, page: query.page, pageSize: query.pageSize, total };
}

export async function getCaseNotificationById(id: string): Promise<CaseNotification> {
  const caseNotification = await prisma.caseNotification.findUnique({ where: { id } });
  if (!caseNotification || caseNotification.deletedAt) {
    throw new AppError("Case notification not found", 404);
  }
  return caseNotification;
}

/** Só o autor do registro ou um ADMIN podem alterá-lo. */
export async function updateCaseNotification(
  id: string,
  input: UpdateCaseNotificationInput,
  actor: AuthUser
): Promise<CaseNotification> {
  const existing = await getCaseNotificationById(id);
  if (actor.role !== "ADMIN" && existing.reportedById !== actor.id) {
    throw new AppError("You can only update case notifications you reported", 403);
  }

  try {
    return await prisma.caseNotification.update({ where: { id }, data: input });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new AppError("Referenced disease, region, or user does not exist", 400);
    }
    throw error;
  }
}

/** Exclusão lógica (decisão D7): marca `deletedAt` e preserva o registro. */
export async function deleteCaseNotification(id: string): Promise<void> {
  await getCaseNotificationById(id);
  await prisma.caseNotification.update({ where: { id }, data: { deletedAt: new Date() } });
}
