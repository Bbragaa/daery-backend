import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import * as healthInstitutionService from "../../services/health-institution.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    healthInstitution: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  healthInstitution: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function baseInstitution(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "institution-1",
    name: "Hospital das Clinicas",
    cnesCode: "1234567",
    type: "HOSPITAL",
    regionId: "region-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createHealthInstitution", () => {
  it("creates and returns the health institution", async () => {
    mockedPrisma.healthInstitution.create.mockImplementation(async ({ data }) => baseInstitution(data));

    const result = await healthInstitutionService.createHealthInstitution({
      name: "Hospital das Clinicas",
      cnesCode: "1234567",
      type: "HOSPITAL",
      regionId: "region-1",
    });

    expect(result.id).toBe("institution-1");
    expect(result.name).toBe("Hospital das Clinicas");
  });

  it("throws a 400 AppError when the referenced region does not exist", async () => {
    mockedPrisma.healthInstitution.create.mockRejectedValue({ code: "P2003" });

    await expect(
      healthInstitutionService.createHealthInstitution({
        name: "Hospital das Clinicas",
        type: "HOSPITAL",
        regionId: "missing",
      })
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<AppError>);
  });

  it("throws a 409 AppError when the CNES code is already in use", async () => {
    mockedPrisma.healthInstitution.create.mockRejectedValue({ code: "P2002" });

    await expect(
      healthInstitutionService.createHealthInstitution({
        name: "Hospital das Clinicas",
        cnesCode: "1234567",
        type: "HOSPITAL",
        regionId: "region-1",
      })
    ).rejects.toMatchObject({ statusCode: 409 } as Partial<AppError>);
  });

  it("does not swallow unrelated database errors", async () => {
    mockedPrisma.healthInstitution.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      healthInstitutionService.createHealthInstitution({
        name: "Hospital das Clinicas",
        type: "HOSPITAL",
        regionId: "region-1",
      })
    ).rejects.toThrow("connection lost");
  });
});

describe("getHealthInstitutionById", () => {
  it("returns the health institution when found", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(baseInstitution());

    const result = await healthInstitutionService.getHealthInstitutionById("institution-1");

    expect(result.id).toBe("institution-1");
  });

  it("throws a 404 AppError when the health institution does not exist", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(null);

    await expect(healthInstitutionService.getHealthInstitutionById("missing")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
  });
});

describe("getAllHealthInstitutions", () => {
  it("returns all health institutions", async () => {
    mockedPrisma.healthInstitution.findMany.mockResolvedValue([
      baseInstitution(),
      baseInstitution({ id: "institution-2" }),
    ]);

    const result = await healthInstitutionService.getAllHealthInstitutions();

    expect(result).toHaveLength(2);
  });
});

describe("updateHealthInstitution", () => {
  it("throws a 404 AppError when the health institution does not exist", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(null);

    await expect(
      healthInstitutionService.updateHealthInstitution("missing", { name: "New Name" })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<AppError>);
    expect(mockedPrisma.healthInstitution.update).not.toHaveBeenCalled();
  });

  it("updates and returns the health institution when it exists", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(baseInstitution());
    mockedPrisma.healthInstitution.update.mockImplementation(async ({ data }) => baseInstitution(data));

    const result = await healthInstitutionService.updateHealthInstitution("institution-1", {
      name: "New Name",
    });

    expect(result.name).toBe("New Name");
  });

  it("throws a 400 AppError when updating to a referenced region that does not exist", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(baseInstitution());
    mockedPrisma.healthInstitution.update.mockRejectedValue({ code: "P2003" });

    await expect(
      healthInstitutionService.updateHealthInstitution("institution-1", { regionId: "missing" })
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<AppError>);
  });

  it("throws a 409 AppError when updating to a CNES code already in use", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(baseInstitution());
    mockedPrisma.healthInstitution.update.mockRejectedValue({ code: "P2002" });

    await expect(
      healthInstitutionService.updateHealthInstitution("institution-1", { cnesCode: "7654321" })
    ).rejects.toMatchObject({ statusCode: 409 } as Partial<AppError>);
  });
});

describe("deleteHealthInstitution", () => {
  it("throws a 404 AppError when the health institution does not exist", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(null);

    await expect(healthInstitutionService.deleteHealthInstitution("missing")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
    expect(mockedPrisma.healthInstitution.delete).not.toHaveBeenCalled();
  });

  it("deletes the health institution when it exists", async () => {
    mockedPrisma.healthInstitution.findUnique.mockResolvedValue(baseInstitution());
    mockedPrisma.healthInstitution.delete.mockResolvedValue(baseInstitution());

    await healthInstitutionService.deleteHealthInstitution("institution-1");

    expect(mockedPrisma.healthInstitution.delete).toHaveBeenCalledWith({ where: { id: "institution-1" } });
  });
});
