import { z } from "zod";

export const createCaseNotificationSchema = z.object({
  diseaseId: z.string().uuid(),
  regionId: z.string().uuid(),
  institutionId: z.string().uuid(),
  reportedById: z.string().uuid(),
  patientAgeRange: z.string().min(1),
  patientSex: z.enum(["M", "F", "OTHER", "UNKNOWN"]),
  status: z.enum(["SUSPECTED", "CONFIRMED", "DISCARDED", "DEATH"]).optional(),
  notificationDate: z.coerce.date().optional(),
  symptomsOnsetDate: z.coerce.date().optional(),
});

export const updateCaseNotificationSchema = z.object({
  diseaseId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  reportedById: z.string().uuid().optional(),
  patientAgeRange: z.string().min(1).optional(),
  patientSex: z.enum(["M", "F", "OTHER", "UNKNOWN"]).optional(),
  status: z.enum(["SUSPECTED", "CONFIRMED", "DISCARDED", "DEATH"]).optional(),
  notificationDate: z.coerce.date().optional(),
  symptomsOnsetDate: z.coerce.date().optional(),
});
