import { z } from "zod";
import { UFS } from "./auth.validation";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_PERIOD_DAYS = 366;
export const DEFAULT_PERIOD_DAYS = 56; // 8 semanas

/** "2026-10-09" → Date em 00:00 UTC. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use the format YYYY-MM-DD")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), "invalid date");

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Período fechado [startDate, endDate]. Sem datas: as últimas 8 semanas até hoje.
 * Limitado a 366 dias para manter a consulta leve.
 */
const periodFields = {
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
};

function resolvePeriod<T extends { startDate?: Date; endDate?: Date }>(value: T) {
  const endDate = value.endDate ?? todayUtc();
  const startDate = value.startDate ?? new Date(endDate.getTime() - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS);
  return { ...value, startDate, endDate };
}

function checkPeriod(value: { startDate: Date; endDate: Date }, ctx: z.RefinementCtx) {
  if (value.startDate > value.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "startDate must be before endDate" });
  } else if ((value.endDate.getTime() - value.startDate.getTime()) / DAY_MS + 1 > MAX_PERIOD_DAYS) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: `period must be at most ${MAX_PERIOD_DAYS} days` });
  }
}

const locationFilters = {
  diseaseId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  uf: z.enum(UFS).optional(),
};

export const summaryQuerySchema = z
  .object({ ...locationFilters, ...periodFields })
  .strict()
  .transform(resolvePeriod)
  .superRefine(checkPeriod);

export type SummaryQuery = z.output<typeof summaryQuerySchema>;

export const alertsQuerySchema = z
  .object({
    diseaseId: locationFilters.diseaseId,
    regionId: locationFilters.regionId,
    uf: locationFilters.uf,
    // 3 = transmissão aumentada e sustentada; 4 = incidência acima de 90% do histórico.
    minLevel: z.coerce.number().int().min(1).max(4).default(3),
    // Quantas semanas para trás procurar a situação mais recente de cada município.
    weeks: z.coerce.number().int().min(1).max(12).default(4),
  })
  .strict();

export type AlertsQuery = z.output<typeof alertsQuerySchema>;

export const caseNotificationListQuerySchema = z
  .object({
    ...locationFilters,
    status: z.enum(["SUSPECTED", "CONFIRMED", "DISCARDED", "DEATH"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    ...periodFields,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate) checkPeriod({ startDate: value.startDate, endDate: value.endDate }, ctx);
  });

export type CaseNotificationListQuery = z.output<typeof caseNotificationListQuerySchema>;
