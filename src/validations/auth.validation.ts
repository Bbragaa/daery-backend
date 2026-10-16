import { z } from "zod";
import { isValidCnpj, isValidCpf, onlyDigits } from "../utils/documents";

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** Conselhos regionais aceitos no cadastro de profissional de saúde. */
export const HEALTH_COUNCILS = [
  "CRM", // Medicina
  "COREN", // Enfermagem
  "CRF", // Farmácia
  "CRO", // Odontologia
  "CREFITO", // Fisioterapia e Terapia Ocupacional
  "CRN", // Nutrição
  "CRP", // Psicologia
  "CRBM", // Biomedicina
  "CRFa", // Fonoaudiologia
] as const;

const cpfField = z
  .string()
  .refine(isValidCpf, "cpf must be a valid CPF")
  .transform(onlyDigits);

const passwordField = z
  .string()
  .min(8, "password must be at least 8 characters")
  .max(72, "password must be at most 72 characters"); // limite do bcrypt

const baseRegister = {
  name: z.string().trim().min(1, "name is required").max(120),
  email: z.string().trim().toLowerCase().email("email must be valid"),
  password: passwordField,
  cpf: cpfField,
  // LGPD: o cadastro só é aceito com o consentimento explícito do titular.
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "acceptTerms must be true" }),
  }),
};

export const registerSchema = z.discriminatedUnion("accountType", [
  z.object({ accountType: z.literal("CITIZEN"), ...baseRegister }),
  z.object({
    accountType: z.literal("HEALTH_PROFESSIONAL"),
    ...baseRegister,
    professional: z.object({
      council: z.enum(HEALTH_COUNCILS),
      registrationNumber: z
        .string()
        .trim()
        .regex(/^[0-9A-Za-z-]{1,20}$/, "registrationNumber must have 1 to 20 letters, digits or hyphens"),
      uf: z.enum(UFS),
      specialty: z.string().trim().max(120).optional(),
    }),
  }),
  z.object({
    accountType: z.literal("INSTITUTION"),
    ...baseRegister,
    institution: z.object({
      name: z.string().trim().min(1, "institution name is required").max(200),
      cnpj: z.string().refine(isValidCnpj, "cnpj must be a valid CNPJ").transform(onlyDigits),
    }),
  }),
]);

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("email must be valid"),
  password: z.string().min(1, "password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// O próprio usuário altera apenas o nome nesta fase. E-mail, CPF e perfil não mudam por aqui.
export const updateMeSchema = z
  .object({ name: z.string().trim().min(1, "name is required").max(120) })
  .strict();

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
