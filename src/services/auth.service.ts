import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { signToken } from "../utils/jwt";
import {
  isUniqueConstraintError,
  SafeUser,
  toSafeUser,
  uniqueConstraintTarget,
} from "../utils/safe-user";
import { LoginInput, RegisterInput, UpdateMeInput } from "../validations/auth.validation";

export interface AuthResult {
  token: string;
  user: SafeUser;
}

// Hash usado quando o e-mail não existe, para que a resposta demore o mesmo
// tempo de um login com senha errada (evita descobrir e-mails cadastrados).
const DUMMY_HASH = bcrypt.hashSync("daery-timing-equalizer", env.BCRYPT_SALT_ROUNDS);

const INVALID_CREDENTIALS = "Invalid credentials";

function conflictMessage(error: unknown): string {
  const target = uniqueConstraintTarget(error);
  if (target.includes("email")) return "Email already in use";
  if (target.includes("cpf")) return "CPF already in use";
  if (target.includes("cnpj")) return "CNPJ already in use";
  if (target.includes("registrationNumber") || target.includes("council")) {
    return "Professional registration already in use";
  }
  return "Registration data already in use";
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  // Todo cadastro público nasce como CITIZEN. Profissional e instituição ficam
  // PENDING até um ADMIN aprovar (decisão D3).
  const base = {
    name: input.name,
    email: input.email,
    passwordHash,
    cpf: input.cpf,
    role: "CITIZEN" as const,
    // Prova do consentimento: o schema só aceita o cadastro com acceptTerms = true.
    termsAcceptedAt: new Date(),
    termsVersion: env.TERMS_VERSION,
  };

  let data;
  if (input.accountType === "HEALTH_PROFESSIONAL") {
    data = {
      ...base,
      requestedRole: "HEALTH_PROFESSIONAL" as const,
      verificationStatus: "PENDING" as const,
      professionalRegistration: { create: input.professional },
    };
  } else if (input.accountType === "INSTITUTION") {
    data = {
      ...base,
      requestedRole: "INSTITUTION" as const,
      verificationStatus: "PENDING" as const,
      institution: { create: input.institution },
    };
  } else {
    data = base;
  }

  try {
    const user = await prisma.user.create({ data });
    return { token: signToken({ sub: user.id, role: user.role }), user: toSafeUser(user) };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(conflictMessage(error), 409);
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  // Mesma mensagem para e-mail inexistente, senha errada e conta desativada.
  if (!user || !passwordMatches || !user.isActive) {
    throw new AppError(INVALID_CREDENTIALS, 401);
  }

  return { token: signToken({ sub: user.id, role: user.role }), user: toSafeUser(user) };
}

export async function getMe(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { professionalRegistration: true, institution: true },
  });
  if (!user || !user.isActive) {
    throw new AppError("User not found", 404);
  }
  const { professionalRegistration, institution, ...rest } = user;
  return { ...toSafeUser(rest), professionalRegistration, institution };
}

export async function updateMe(id: string, input: UpdateMeInput) {
  await prisma.user.update({ where: { id }, data: { name: input.name } });
  return getMe(id);
}
