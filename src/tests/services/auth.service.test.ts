import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import * as authService from "../../services/auth.service";
import { AppError } from "../../utils/AppError";
import { verifyToken } from "../../utils/jwt";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
};

function storedUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    name: "Ana Souza",
    email: "ana@example.com",
    passwordHash: bcrypt.hashSync("senha-segura-123", 4),
    role: "CITIZEN",
    requestedRole: null,
    verificationStatus: "NOT_REQUIRED",
    cpf: "52998224725",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const citizenInput = {
  accountType: "CITIZEN" as const,
  name: "Ana Souza",
  email: "ana@example.com",
  password: "senha-segura-123",
  cpf: "52998224725",
  acceptTerms: true as const,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("register", () => {
  it("creates a CITIZEN account and returns a valid token without exposing secrets", async () => {
    mockedPrisma.user.create.mockImplementation(async ({ data }) => storedUser(data));

    const result = await authService.register(citizenInput);

    const data = mockedPrisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe("CITIZEN");
    expect(data.passwordHash).not.toBe(citizenInput.password);
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user.cpf).toBe("***.982.247-**");
    expect(verifyToken(result.token)?.sub).toBe("user-1");
  });

  it("records when and which version of the consent text was accepted", async () => {
    mockedPrisma.user.create.mockImplementation(async ({ data }) => storedUser(data));
    const before = Date.now();

    const result = await authService.register(citizenInput);

    const data = mockedPrisma.user.create.mock.calls[0][0].data;
    expect(data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(data.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.termsVersion).toBe(env.TERMS_VERSION);
    expect(result.user.termsVersion).toBe(env.TERMS_VERSION);
  });

  it("creates a health professional as CITIZEN with a PENDING verification", async () => {
    mockedPrisma.user.create.mockImplementation(async ({ data }) => storedUser(data));

    await authService.register({
      ...citizenInput,
      accountType: "HEALTH_PROFESSIONAL",
      professional: { council: "CRM", registrationNumber: "12345", uf: "GO" },
    });

    const data = mockedPrisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe("CITIZEN");
    expect(data.requestedRole).toBe("HEALTH_PROFESSIONAL");
    expect(data.verificationStatus).toBe("PENDING");
    expect(data.professionalRegistration.create).toEqual({
      council: "CRM",
      registrationNumber: "12345",
      uf: "GO",
    });
  });

  it("creates an institution as CITIZEN with a PENDING verification", async () => {
    mockedPrisma.user.create.mockImplementation(async ({ data }) => storedUser(data));

    await authService.register({
      ...citizenInput,
      accountType: "INSTITUTION",
      institution: { name: "Hospital Exemplo", cnpj: "11222333000181" },
    });

    const data = mockedPrisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe("CITIZEN");
    expect(data.requestedRole).toBe("INSTITUTION");
    expect(data.verificationStatus).toBe("PENDING");
  });

  it.each([
    [["email"], "Email already in use"],
    [["cpf"], "CPF already in use"],
    [["cnpj"], "CNPJ already in use"],
    [["council", "uf", "registrationNumber"], "Professional registration already in use"],
  ])("maps a unique violation on %j to a 409 with a specific message", async (target, message) => {
    mockedPrisma.user.create.mockRejectedValue({ code: "P2002", meta: { target } });

    await expect(authService.register(citizenInput)).rejects.toMatchObject({
      statusCode: 409,
      message,
    } as Partial<AppError>);
  });

  it("does not swallow unrelated database errors", async () => {
    mockedPrisma.user.create.mockRejectedValue(new Error("connection lost"));

    await expect(authService.register(citizenInput)).rejects.toThrow("connection lost");
  });
});

describe("login", () => {
  it("returns a token for valid credentials", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(storedUser({ role: "HEALTH_PROFESSIONAL" }));

    const result = await authService.login({ email: "ana@example.com", password: "senha-segura-123" });

    expect(verifyToken(result.token)).toEqual({ sub: "user-1", role: "HEALTH_PROFESSIONAL" });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it.each([
    ["a wrong password", storedUser(), "senha-errada-000"],
    ["an unknown email", null, "senha-segura-123"],
    ["a deactivated account", storedUser({ isActive: false }), "senha-segura-123"],
  ])("answers 401 with the same message for %s", async (_label, user, password) => {
    mockedPrisma.user.findUnique.mockResolvedValue(user);

    await expect(authService.login({ email: "ana@example.com", password })).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials",
    } as Partial<AppError>);
  });

  it("still runs a bcrypt comparison when the email does not exist (timing)", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    const compareSpy = jest.spyOn(bcrypt, "compare");

    await expect(
      authService.login({ email: "nobody@example.com", password: "x" })
    ).rejects.toBeInstanceOf(AppError);

    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();
  });
});

describe("getMe", () => {
  it("returns the user with masked CPF and registration data", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({
      ...storedUser(),
      professionalRegistration: { council: "CRM", registrationNumber: "12345", uf: "GO" },
      institution: null,
    });

    const me = await authService.getMe("user-1");

    expect(me).not.toHaveProperty("passwordHash");
    expect(me.cpf).toBe("***.982.247-**");
    expect(me.professionalRegistration).toMatchObject({ council: "CRM" });
  });

  it("throws 404 for a deactivated user", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ ...storedUser({ isActive: false }) });

    await expect(authService.getMe("user-1")).rejects.toMatchObject({ statusCode: 404 } as Partial<AppError>);
  });
});

describe("updateMe", () => {
  it("changes only the name and returns the refreshed user", async () => {
    mockedPrisma.user.update.mockResolvedValue({});
    mockedPrisma.user.findUnique.mockResolvedValue({
      ...storedUser({ name: "Ana Maria Souza" }),
      professionalRegistration: null,
      institution: null,
    });

    const me = await authService.updateMe("user-1", { name: "Ana Maria Souza" });

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { name: "Ana Maria Souza" } });
    expect(me.name).toBe("Ana Maria Souza");
    expect(me).not.toHaveProperty("passwordHash");
  });
});
