import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import * as caseNotificationService from "../../services/case-notification.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    caseNotification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  caseNotification: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function baseCase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "case-1",
    diseaseId: "disease-1",
    regionId: "region-1",
    reportedById: "user-1",
    patientAgeRange: "20-29",
    patientSex: "F",
    status: "SUSPECTED",
    notificationDate: new Date("2026-01-01T00:00:00.000Z"),
    symptomsOnsetDate: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createCaseNotification", () => {
  it("creates and returns the case notification", async () => {
    mockedPrisma.caseNotification.create.mockImplementation(async ({ data }) => baseCase(data));

    const result = await caseNotificationService.createCaseNotification({
      diseaseId: "disease-1",
      regionId: "region-1",
      reportedById: "user-1",
      patientAgeRange: "20-29",
      patientSex: "F",
    });

    expect(result.id).toBe("case-1");
    expect(result.patientAgeRange).toBe("20-29");
  });

  it("throws a 400 AppError when a referenced disease/region/user does not exist", async () => {
    mockedPrisma.caseNotification.create.mockRejectedValue({ code: "P2003" });

    await expect(
      caseNotificationService.createCaseNotification({
        diseaseId: "missing",
        regionId: "region-1",
        reportedById: "user-1",
        patientAgeRange: "20-29",
        patientSex: "F",
      })
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<AppError>);
  });

  it("does not swallow unrelated database errors", async () => {
    mockedPrisma.caseNotification.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      caseNotificationService.createCaseNotification({
        diseaseId: "disease-1",
        regionId: "region-1",
        reportedById: "user-1",
        patientAgeRange: "20-29",
        patientSex: "F",
      })
    ).rejects.toThrow("connection lost");
  });
});

describe("getCaseNotificationById", () => {
  it("returns the case notification when found", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());

    const result = await caseNotificationService.getCaseNotificationById("case-1");

    expect(result.id).toBe("case-1");
  });

  it("throws a 404 AppError when the case notification does not exist", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(null);

    await expect(caseNotificationService.getCaseNotificationById("missing")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
  });
});

describe("getAllCaseNotifications", () => {
  it("returns all case notifications", async () => {
    mockedPrisma.caseNotification.findMany.mockResolvedValue([baseCase(), baseCase({ id: "case-2" })]);

    const result = await caseNotificationService.getAllCaseNotifications();

    expect(result).toHaveLength(2);
  });
});

describe("updateCaseNotification", () => {
  it("throws a 404 AppError when the case notification does not exist", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(null);

    await expect(
      caseNotificationService.updateCaseNotification("missing", { status: "CONFIRMED" })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<AppError>);
    expect(mockedPrisma.caseNotification.update).not.toHaveBeenCalled();
  });

  it("updates and returns the case notification when it exists", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());
    mockedPrisma.caseNotification.update.mockImplementation(async ({ data }) =>
      baseCase(data)
    );

    const result = await caseNotificationService.updateCaseNotification("case-1", {
      status: "CONFIRMED",
    });

    expect(result.status).toBe("CONFIRMED");
  });

  it("throws a 400 AppError when updating to a referenced disease/region/user that does not exist", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());
    mockedPrisma.caseNotification.update.mockRejectedValue({ code: "P2003" });

    await expect(
      caseNotificationService.updateCaseNotification("case-1", { diseaseId: "missing" })
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<AppError>);
  });
});

describe("deleteCaseNotification", () => {
  it("throws a 404 AppError when the case notification does not exist", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(null);

    await expect(caseNotificationService.deleteCaseNotification("missing")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
    expect(mockedPrisma.caseNotification.delete).not.toHaveBeenCalled();
  });

  it("deletes the case notification when it exists", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());
    mockedPrisma.caseNotification.delete.mockResolvedValue(baseCase());

    await caseNotificationService.deleteCaseNotification("case-1");

    expect(mockedPrisma.caseNotification.delete).toHaveBeenCalledWith({ where: { id: "case-1" } });
  });
});
