import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/** Limita tentativas de login e cadastro por IP (proteção contra força bruta). */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});
