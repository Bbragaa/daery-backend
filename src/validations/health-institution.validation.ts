import { z } from "zod";

export const createHealthInstitutionSchema = z.object({
  name: z.string().min(1),
  cnesCode: z.string().min(1).optional(),
  type: z.enum(["HOSPITAL", "CLINIC", "LABORATORY", "UBS"]),
  regionId: z.string().uuid(),
});

export const updateHealthInstitutionSchema = z.object({
  name: z.string().min(1).optional(),
  cnesCode: z.string().min(1).optional(),
  type: z.enum(["HOSPITAL", "CLINIC", "LABORATORY", "UBS"]).optional(),
  regionId: z.string().uuid().optional(),
});
