import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import * as userService from "../../services/user.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

function baseUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    passwordHash: "irrelevant-stored-hash",
    role: "HEALTH_PROFESSIONAL",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createUser", () => {
  it("stores a real bcrypt hash of the password, not the plaintext", async () => {
    const rawPassword = "correct horse battery staple";
    mockedPrisma.user.create.mockImplementation(async ({ data }) => baseUser(data));

    await userService.createUser({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: rawPassword,
    });

    const createArg = mockedPrisma.user.create.mock.calls[0][0];
    const storedHash: string = createArg.data.passwordHash;

    expect(storedHash).not.toBe(rawPassword);
    expect(bcrypt.compareSync(rawPassword, storedHash)).toBe(true);
    expect(bcrypt.compareSync("wrong password", storedHash)).toBe(false);
  });

  it("never returns passwordHash to the caller", async () => {
    mockedPrisma.user.create.mockImplementation(async ({ data }) => baseUser(data));

    const result = await userService.createUser({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "correct horse battery staple",
    });

    expect(result).not.toHaveProperty("passwordHash");
    expect(result.email).toBe("ada@example.com");
  });

  it("throws a 409 AppError when the email is already taken", async () => {
    mockedPrisma.user.create.mockRejectedValue({ code: "P2002" });

    await expect(
      userService.createUser({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "correct horse battery staple",
      })
    ).rejects.toMatchObject({ statusCode: 409 } as Partial<AppError>);
  });

  it("does not swallow unrelated database errors", async () => {
    mockedPrisma.user.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      userService.createUser({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "correct horse battery staple",
      })
    ).rejects.toThrow("connection lost");
  });
});

describe("getUserById", () => {
  it("returns the user without passwordHash when active", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser());

    const result = await userService.getUserById("user-1");

    expect(result).not.toHaveProperty("passwordHash");
    expect(result.id).toBe("user-1");
  });

  it("throws a 404 AppError when the user does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    await expect(userService.getUserById("missing")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
  });

  it("throws a 404 AppError when the user is deactivated", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser({ isActive: false }));

    await expect(userService.getUserById("user-1")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
  });
});

describe("getAllUsers", () => {
  it("only queries active users and strips passwordHash from every result", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([baseUser(), baseUser({ id: "user-2" })]);

    const result = await userService.getAllUsers();

    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(result).toHaveLength(2);
    result.forEach((user) => expect(user).not.toHaveProperty("passwordHash"));
  });
});

describe("updateUser", () => {
  it("re-hashes the password only when a new one is supplied", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser());
    mockedPrisma.user.update.mockImplementation(async ({ data }) => baseUser(data));

    await userService.updateUser("user-1", { name: "Ada King" });

    const updateArg = mockedPrisma.user.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty("passwordHash");
    expect(updateArg.data).not.toHaveProperty("password");
  });

  it("stores a fresh real bcrypt hash when a new password is supplied", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser());
    mockedPrisma.user.update.mockImplementation(async ({ data }) => baseUser(data));

    const newPassword = "a brand new password";
    await userService.updateUser("user-1", { password: newPassword });

    const updateArg = mockedPrisma.user.update.mock.calls[0][0];
    expect(bcrypt.compareSync(newPassword, updateArg.data.passwordHash)).toBe(true);
  });

  it("throws a 404 AppError when the user does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    await expect(userService.updateUser("missing", { name: "X" })).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("throws a 409 AppError when updating to an email already in use", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser());
    mockedPrisma.user.update.mockRejectedValue({ code: "P2002" });

    await expect(
      userService.updateUser("user-1", { email: "taken@example.com" })
    ).rejects.toMatchObject({ statusCode: 409 } as Partial<AppError>);
  });
});

describe("deactivateUser", () => {
  it("sets isActive to false instead of deleting the row", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser());
    mockedPrisma.user.update.mockResolvedValue(baseUser({ isActive: false }));

    await userService.deactivateUser("user-1");

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isActive: false },
    });
  });

  it("throws a 404 AppError when the user does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    await expect(userService.deactivateUser("missing")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe("getAllUsers with a verification filter", () => {
  it("adds the verificationStatus filter to the query", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([]);

    await userService.getAllUsers({ verificationStatus: "PENDING" });

    expect(mockedPrisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: true, verificationStatus: "PENDING" },
    });
  });
});

describe("reviewVerification", () => {
  it("grants the requested role when approved", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(
      baseUser({ role: "CITIZEN", requestedRole: "HEALTH_PROFESSIONAL", verificationStatus: "PENDING" })
    );
    mockedPrisma.user.update.mockImplementation(async ({ data }) => baseUser(data));

    const result = await userService.reviewVerification("user-1", "APPROVED");

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { verificationStatus: "APPROVED", role: "HEALTH_PROFESSIONAL" },
    });
    expect(result.role).toBe("HEALTH_PROFESSIONAL");
  });

  it("keeps the CITIZEN role when rejected", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(
      baseUser({ role: "CITIZEN", requestedRole: "INSTITUTION", verificationStatus: "PENDING" })
    );
    mockedPrisma.user.update.mockImplementation(async ({ data }) => baseUser({ role: "CITIZEN", ...data }));

    await userService.reviewVerification("user-1", "REJECTED");

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { verificationStatus: "REJECTED" },
    });
  });

  it("throws 409 when there is no pending verification", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser({ verificationStatus: "NOT_REQUIRED" }));

    await expect(userService.reviewVerification("user-1", "APPROVED")).rejects.toMatchObject({
      statusCode: 409,
    } as Partial<AppError>);
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("throws 404 when the user does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    await expect(userService.reviewVerification("missing", "APPROVED")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
  });
});

describe("admin safeguards", () => {
  it("refuses to let an admin deactivate their own account", async () => {
    await expect(userService.deactivateUser("admin-1", "admin-1")).rejects.toMatchObject({ statusCode: 409 });
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("lets an admin deactivate another account", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser({ id: "admin-2", role: "ADMIN" }));
    mockedPrisma.user.update.mockResolvedValue(baseUser({ id: "admin-2", isActive: false }));

    await userService.deactivateUser("admin-2", "admin-1");

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({ where: { id: "admin-2" }, data: { isActive: false } });
  });

  it("refuses to let an admin change their own role", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser({ id: "admin-1", role: "ADMIN" }));

    await expect(userService.updateUser("admin-1", { role: "CITIZEN" }, "admin-1")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it("still lets an admin edit their own name", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser({ id: "admin-1", role: "ADMIN" }));
    mockedPrisma.user.update.mockResolvedValue(baseUser({ id: "admin-1", role: "ADMIN", name: "Novo" }));

    await userService.updateUser("admin-1", { name: "Novo", role: "ADMIN" }, "admin-1");

    expect(mockedPrisma.user.update.mock.calls[0][0].data).toEqual({ name: "Novo" });
  });
});

describe("role set directly by an admin", () => {
  it("marks a promoted health professional as approved and clears the pending queue", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(
      baseUser({ role: "CITIZEN", requestedRole: "HEALTH_PROFESSIONAL", verificationStatus: "PENDING" })
    );
    mockedPrisma.user.update.mockResolvedValue(baseUser());

    await userService.updateUser("user-1", { role: "HEALTH_PROFESSIONAL" }, "admin-1");

    expect(mockedPrisma.user.update.mock.calls[0][0].data).toEqual({
      role: "HEALTH_PROFESSIONAL",
      requestedRole: "HEALTH_PROFESSIONAL",
      verificationStatus: "APPROVED",
    });
  });

  it("clears the verification fields when a professional becomes a citizen", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(
      baseUser({ requestedRole: "HEALTH_PROFESSIONAL", verificationStatus: "APPROVED" })
    );
    mockedPrisma.user.update.mockResolvedValue(baseUser({ role: "CITIZEN" }));

    await userService.updateUser("user-1", { role: "CITIZEN" }, "admin-1");

    expect(mockedPrisma.user.update.mock.calls[0][0].data).toEqual({
      role: "CITIZEN",
      requestedRole: null,
      verificationStatus: "NOT_REQUIRED",
    });
  });

  it("does not touch the verification fields when the role stays the same", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(baseUser({ verificationStatus: "APPROVED" }));
    mockedPrisma.user.update.mockResolvedValue(baseUser());

    await userService.updateUser("user-1", { role: "HEALTH_PROFESSIONAL", name: "Ada" }, "admin-1");

    expect(mockedPrisma.user.update.mock.calls[0][0].data).toEqual({ name: "Ada" });
  });

  it("creates an institution account as already approved", async () => {
    mockedPrisma.user.create.mockResolvedValue(baseUser({ role: "INSTITUTION" }));

    await userService.createUser({ name: "Hospital", email: "h@x.com", password: "senha-segura", role: "INSTITUTION" });

    expect(mockedPrisma.user.create.mock.calls[0][0].data).toMatchObject({
      role: "INSTITUTION",
      requestedRole: "INSTITUTION",
      verificationStatus: "APPROVED",
    });
  });
});
