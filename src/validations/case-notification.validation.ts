import { z } from "zod";

// Faixas etárias aceitas (corrige P16: texto livre impedia agregar os dados).
// Sem idade exata nem dados que identifiquem o paciente (RNE002/LGPD).
export const AGE_RANGES = [
  "0-4", "5-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "70-79", "80+", "IGNORADA",
] as const;

const SEXES = ["M", "F", "OTHER", "UNKNOWN"] as const;
const STATUSES = ["SUSPECTED", "CONFIRMED", "DISCARDED", "DEATH"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
// Folga de um dia para diferenças de fuso entre o navegador e o servidor.
const notInFuture = (date: Date) => date.getTime() <= Date.now() + DAY_MS;

const dateField = z.coerce.date().refine(notInFuture, "date cannot be in the future");

function onsetBeforeNotification(
  value: { notificationDate?: Date; symptomsOnsetDate?: Date },
  ctx: z.RefinementCtx
) {
  const notification = value.notificationDate ?? new Date();
  if (value.symptomsOnsetDate && value.symptomsOnsetDate > notification) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["symptomsOnsetDate"],
      message: "symptomsOnsetDate must be on or before notificationDate",
    });
  }
}

// `reportedById` não é aceito: o autor é sempre o usuário autenticado (req.user).
export const createCaseNotificationSchema = z
  .object({
    diseaseId: z.string().uuid(),
    regionId: z.string().uuid(),
    patientAgeRange: z.enum(AGE_RANGES),
    patientSex: z.enum(SEXES),
    status: z.enum(STATUSES).optional(),
    notificationDate: dateField.optional(),
    symptomsOnsetDate: dateField.optional(),
  })
  .strict()
  .superRefine(onsetBeforeNotification);

export const updateCaseNotificationSchema = z
  .object({
    diseaseId: z.string().uuid().optional(),
    regionId: z.string().uuid().optional(),
    patientAgeRange: z.enum(AGE_RANGES).optional(),
    patientSex: z.enum(SEXES).optional(),
    status: z.enum(STATUSES).optional(),
    notificationDate: dateField.optional(),
    symptomsOnsetDate: dateField.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Só dá para comparar quando as duas datas vêm na mesma alteração.
    if (value.notificationDate && value.symptomsOnsetDate) onsetBeforeNotification(value, ctx);
  });
