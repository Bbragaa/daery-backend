// Variáveis mínimas para carregar `config/env.ts` nos testes.
// Nenhum teste acessa um banco real: o Prisma Client é sempre mockado.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.JWT_SECRET = "test-secret-with-at-least-thirty-two-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.BCRYPT_SALT_ROUNDS = "4";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
