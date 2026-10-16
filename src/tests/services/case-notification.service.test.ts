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
      count: jest.fn(),
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
    count: jest.Mock;
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

const author = { id: "user-1", role: "HEALTH_PROFESSIONAL" as const, verificationStatus: "APPROVED" as const };
const otherProfessional = { id: "user-2", role: "HEALTH_PROFESSIONAL" as const, verificationStatus: "APPROVED" as const };
const admin = { id: "admin-1", role: "ADMIN" as const, verificationStatus: "NOT_REQUIRED" as const };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createCaseNotification", () => {
  it("creates and returns the case notification", async () => {
    mockedPrisma.caseNotification.create.mockImplementation(async ({ data }) => baseCase(data));

    const result = await caseNotificationService.createCaseNotification({
      diseaseId: "disease-1",
      regionId: "region-1",
      patientAgeRange: "20-29",
      patientSex: "F",
    }, "user-1");

    expect(result.id).toBe("case-1");
    expect(result.patientAgeRange).toBe("20-29");
  });

  it("takes the author from the authenticated user, not from the input", async () => {
    mockedPrisma.caseNotification.create.mockImplementation(async ({ data }) => baseCase(data));

    await caseNotificationService.createCaseNotification(
      { diseaseId: "disease-1", regionId: "region-1", patientAgeRange: "20-29", patientSex: "F" },
      "author-42"
    );

    expect(mockedPrisma.caseNotification.create.mock.calls[0][0].data.reportedById).toBe("author-42");
  });

  it("throws a 400 AppError when a referenced disease/region/user does not exist", async () => {
    mockedPrisma.caseNotification.create.mockRejectedValue({ code: "P2003" });

    await expect(
      caseNotificationService.createCaseNotification({
        diseaseId: "missing",
        regionId: "region-1",
        patientAgeRange: "20-29",
        patientSex: "F",
      }, "user-1")
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<AppError>);
  });

  it("does not swallow unrelated database errors", async () => {
    mockedPrisma.caseNotification.create.mockRejectedValue(new Error("connection lost"));

    await expect(
      caseNotificationService.createCaseNotification({
        diseaseId: "disease-1",
        regionId: "region-1",
        patientAgeRange: "20-29",
        patientSex: "F",
      }, "user-1")
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

describe("getCaseNotificationById (soft delete)", () => {
  it("throws a 404 AppError when the case notification was soft-deleted", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase({ deletedAt: new Date() }));

    await expect(caseNotificationService.getCaseNotificationById("case-1")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
  });
});

describe("getAllCaseNotifications", () => {
  it("returns one page of case notifications that were not soft-deleted", async () => {
    mockedPrisma.caseNotification.findMany.mockResolvedValue([baseCase(), baseCase({ id: "case-2" })]);
    mockedPrisma.caseNotification.count.mockResolvedValue(42);

    const result = await caseNotificationService.getAllCaseNotifications({ page: 3, pageSize: 10 });

    expect(result).toMatchObject({ page: 3, pageSize: 10, total: 42 });
    expect(result.data).toHaveLength(2);
    expect(mockedPrisma.caseNotification.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { notificationDate: "desc" },
      skip: 20,
      take: 10,
    });
  });

  it("combines filters and treats endDate as inclusive", async () => {
    mockedPrisma.caseNotification.findMany.mockResolvedValue([]);
    mockedPrisma.caseNotification.count.mockResolvedValue(0);

    await caseNotificationService.getAllCaseNotifications({
      page: 1,
      pageSize: 20,
      uf: "GO",
      status: "CONFIRMED",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-09T00:00:00.000Z"),
    });

    expect(mockedPrisma.caseNotification.count).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        region: { uf: "GO" },
        status: "CONFIRMED",
        notificationDate: {
          gte: new Date("2026-10-01T00:00:00.000Z"),
          lt: new Date("2026-10-10T00:00:00.000Z"),
        },
      },
    });
  });
});

describe("updateCaseNotification", () => {
  it("throws a 404 AppError when the case notification does not exist", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(null);

    await expect(
      caseNotificationService.updateCaseNotification("missing", { status: "CONFIRMED" }, author)
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<AppError>);
    expect(mockedPrisma.caseNotification.update).not.toHaveBeenCalled();
  });

  it("updates and returns the case notification when it exists", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());
    mockedPrisma.caseNotification.update.mockImplementation(async ({ data }) =>
      baseCase(data)
    );

    const result = await caseNotificationService.updateCaseNotification(
      "case-1",
      { status: "CONFIRMED" },
      author
    );

    expect(result.status).toBe("CONFIRMED");
  });

  it("throws a 403 AppError when a professional updates a case reported by someone else", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());

    await expect(
      caseNotificationService.updateCaseNotification("case-1", { status: "CONFIRMED" }, otherProfessional)
    ).rejects.toMatchObject({ statusCode: 403 } as Partial<AppError>);
    expect(mockedPrisma.caseNotification.update).not.toHaveBeenCalled();
  });

  it("lets an ADMIN update any case notification", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());
    mockedPrisma.caseNotification.update.mockImplementation(async ({ data }) => baseCase(data));

    const result = await caseNotificationService.updateCaseNotification(
      "case-1",
      { status: "DISCARDED" },
      admin
    );

    expect(result.status).toBe("DISCARDED");
  });

  it("throws a 400 AppError when updating to a referenced disease/region/user that does not exist", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());
    mockedPrisma.caseNotification.update.mockRejectedValue({ code: "P2003" });

    await expect(
      caseNotificationService.updateCaseNotification("case-1", { diseaseId: "missing" }, author)
    ).rejects.toMatchObject({ statusCode: 400 } as Partial<AppError>);
  });
});

describe("deleteCaseNotification", () => {
  it("throws a 404 AppError when the case notification does not exist", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(null);

    await expect(caseNotificationService.deleteCaseNotification("missing")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<AppError>);
    expect(mockedPrisma.caseNotification.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the case notification instead of removing the row", async () => {
    mockedPrisma.caseNotification.findUnique.mockResolvedValue(baseCase());
    mockedPrisma.caseNotification.update.mockResolvedValue(baseCase());

    await caseNotificationService.deleteCaseNotification("case-1");

    expect(mockedPrisma.caseNotification.delete).not.toHaveBeenCalled();
    const call = mockedPrisma.caseNotification.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "case-1" });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });
});
