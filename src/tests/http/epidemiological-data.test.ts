import request from "supertest";
import { app } from "../../app";
import { prisma } from "../../config/prisma";
import { signToken } from "../../utils/jwt";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    epidemiologicalRecord: { findMany: jest.fn() },
    caseNotification: { findMany: jest.fn(), count: jest.fn() },
  },
}));

const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  epidemiologicalRecord: { findMany: jest.Mock };
  caseNotification: { findMany: jest.Mock; count: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  db.epidemiologicalRecord.findMany.mockResolvedValue([]);
  db.caseNotification.findMany.mockResolvedValue([]);
  db.caseNotification.count.mockResolvedValue(0);
  db.user.findUnique.mockResolvedValue({ id: "pro", role: "HEALTH_PROFESSIONAL", verificationStatus: "APPROVED", isActive: true });
});

describe("GET /api/epidemiological-data/summary", () => {
  it("is public and returns the period and items", async () => {
    const res = await request(app)
      .get("/api/epidemiological-data/summary?startDate=2026-09-01&endDate=2026-10-09&uf=GO")
      .expect(200);

    expect(res.body.period).toEqual({ startDate: "2026-09-01", endDate: "2026-10-09" });
    expect(res.body.items).toEqual([]);
  });

  describe("Daery case counts", () => {
    beforeEach(() => {
      db.caseNotification.findMany.mockResolvedValue([
        { status: "DEATH", region: { id: "r1", name: "Anápolis", uf: "GO", latitude: null, longitude: null }, disease: { id: "d1", name: "Zika" } },
      ]);
    });
    const deathsFor = async (authorization?: string) => {
      const req = request(app).get("/api/epidemiological-data/summary");
      if (authorization) req.set("Authorization", authorization);
      const res = await req.expect(200);
      expect(res.headers.vary).toMatch(/Authorization/);
      return res.body.items[0].platformReports;
    };

    it("suppresses small counts for anonymous visitors", async () => {
      expect(await deathsFor()).toEqual({ suspected: 0, confirmed: 0, deaths: null, suppressed: true });
    });

    it("suppresses small counts for citizens", async () => {
      db.user.findUnique.mockResolvedValue({ id: "cit", role: "CITIZEN", verificationStatus: "NOT_REQUIRED", isActive: true });
      const token = `Bearer ${signToken({ sub: "cit", role: "CITIZEN" })}`;
      expect((await deathsFor(token)).deaths).toBeNull();
    });

    it("shows full counts to professional profiles", async () => {
      const token = `Bearer ${signToken({ sub: "pro", role: "HEALTH_PROFESSIONAL" })}`;
      expect(await deathsFor(token)).toEqual({ suspected: 0, confirmed: 0, deaths: 1, suppressed: false });
    });

    it("treats an invalid token as an anonymous visitor instead of failing", async () => {
      expect((await deathsFor("Bearer not-a-token")).deaths).toBeNull();
    });

    it("treats a deactivated account as an anonymous visitor", async () => {
      db.user.findUnique.mockResolvedValue({ id: "pro", role: "HEALTH_PROFESSIONAL", verificationStatus: "APPROVED", isActive: false });
      const token = `Bearer ${signToken({ sub: "pro", role: "HEALTH_PROFESSIONAL" })}`;
      expect((await deathsFor(token)).deaths).toBeNull();
    });
  });

  it("answers 400 with field details for a bad date", async () => {
    const res = await request(app).get("/api/epidemiological-data/summary?startDate=09-10-2026").expect(400);

    expect(res.body.error).toBe("Invalid query parameters");
    expect(res.body.details.fieldErrors.startDate).toBeDefined();
  });
});

describe("GET /api/alerts", () => {
  it("is public", async () => {
    await request(app).get("/api/alerts?uf=GO").expect(200, []);
  });

  it("rejects an invalid level", async () => {
    await request(app).get("/api/alerts?minLevel=9").expect(400);
  });
});

describe("GET /api/case-notifications (paginated)", () => {
  const auth = `Bearer ${signToken({ sub: "pro", role: "HEALTH_PROFESSIONAL" })}`;

  it("returns a page envelope", async () => {
    db.caseNotification.count.mockResolvedValue(3);

    const res = await request(app)
      .get("/api/case-notifications?page=2&pageSize=1&status=CONFIRMED")
      .set("Authorization", auth)
      .expect(200);

    expect(res.body).toEqual({ data: [], page: 2, pageSize: 1, total: 3 });
    expect(db.caseNotification.findMany.mock.calls[0][0]).toMatchObject({ skip: 1, take: 1 });
  });

  it("rejects an unknown status", async () => {
    await request(app).get("/api/case-notifications?status=MAYBE").set("Authorization", auth).expect(400);
  });
});
