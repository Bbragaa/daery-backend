import { z } from "zod";

const roleField = z.enum(["ADMIN", "HEALTH_PROFESSIONAL", "RESEARCHER", "INSTITUTION", "CITIZEN"]);

// Rotas de /api/users são exclusivas de ADMIN, por isso aceitam `role`.
// O cadastro público usa /api/auth/register, que nunca aceita `role`.
export const createUserSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().trim().toLowerCase().email("email must be valid"),
  password: z.string().min(8, "password must be at least 8 characters").max(72),
  role: roleField.optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(8).max(72).optional(),
  role: roleField.optional(),
});

export const reviewVerificationSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});
