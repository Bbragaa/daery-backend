import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email("email must be valid"),
  password: z.string().min(8, "password must be at least 8 characters"),
  role: z.enum(["ADMIN", "HEALTH_PROFESSIONAL", "RESEARCHER"]).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["ADMIN", "HEALTH_PROFESSIONAL", "RESEARCHER"]).optional(),
});
