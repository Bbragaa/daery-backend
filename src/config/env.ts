import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must have at least 32 characters"),
  JWT_EXPIRES_IN: z.string().min(1).default("1d"),
  // Tentativas de login/cadastro por IP a cada 15 minutos.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  // Versão do texto de consentimento exibido no cadastro (frontend, Register.tsx).
  // Troque sempre que o texto mudar: cada conta guarda a versão que aceitou.
  TERMS_VERSION: z.string().trim().min(1).max(50).default("2026-10-15"),
  // Quantos proxies confiáveis ficam na frente da API (0 = acesso direto).
  // Atrás de um proxy reverso use 1: o limite de tentativas passa a usar o IP real do cliente.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  INFODENGUE_BASE_URL: z.string().url().default("https://info.dengue.mat.br"),
  INFODENGUE_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  // Semanas epidemiológicas buscadas em cada sincronização.
  INFODENGUE_SYNC_WEEKS: z.coerce.number().int().min(1).max(52).default(12),
  // Intervalo da sincronização automática em horas; 0 desliga (use o endpoint ou o script).
  INFODENGUE_SYNC_INTERVAL_HOURS: z.coerce.number().min(0).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

// O valor de exemplo do .env.example tem mais de 32 caracteres e passaria na validação.
// Quem tiver o segredo consegue emitir tokens de ADMIN, então em produção ele é recusado.
const PLACEHOLDER_SECRET = /change-?me/i;
if (PLACEHOLDER_SECRET.test(parsed.data.JWT_SECRET)) {
  if (parsed.data.NODE_ENV === "production") {
    throw new Error("JWT_SECRET still has the example value; generate a random secret for production");
  }
  if (parsed.data.NODE_ENV === "development") {
    console.warn("WARNING: JWT_SECRET still has the example value. Never use it in production.");
  }
}

export const env = parsed.data;
