import request from "supertest";
import { app } from "../../app";
import { prisma } from "../../config/prisma";
import { fetchAlertCity } from "../../integrations/infodengue.client";
import { resetSyncStatus, waitForSync } from "../../services/sync-runner.service";
import { signToken } from "../../utils/jwt";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    disease: { findMany: jest.fn() },
    region: { findMany: jest.fn() },
    epidemiologicalRecord: { upsert: jest.fn() },
  },
}));
jest.mock("../../integrations/infodengue.client", () => ({ fetchAlertCity: jest.fn() }));

const db = prisma as unknown as {
  user: { findUnique: jest.Mock };
  disease: { findMany: jest.Mock };
  region: { findMany: jest.Mock };
  epidemiologicalRecord: { upsert: jest.Mock };
};

const account = (id: string, role: string) => ({ id, role, verificationStatus: "NOT_REQUIRED", isActive: true });
const bearer = (id: string, role: "ADMIN" | "CITIZEN") => `Bearer ${signToken({ sub: id, role })}`;

beforeEach(() => {
  jest.clearAllMocks();
  db.user.findUnique.mockImplementation(async ({ where }) =>
    where.id === "admin" ? account("admin", "ADMIN") : where.id === "citizen" ? account("citizen", "CITIZEN") : null
  );
});

describe("GET /api/diseases", () => {
  it("is public and hides the internal InfoDengue key", async () => {
    db.disease.findMany.mockResolvedValue([
      { id: "d1", name: "Dengue", icdCode: "A90", description: null, category: "viral", riskLevel: "HIGH", infoDengueKey: "dengue" },
      { id: "d2", name: "Gripe", icdCode: null, description: null, category: "respiratoria", riskLevel: "LOW", infoDengueKey: null },
    ]);

    const res = await request(app).get("/api/diseases").expect(200);

    expect(res.body[0]).not.toHaveProperty("infoDengueKey");
    expect(res.body.map((d: { monitoredByInfoDengue: boolean }) => d.monitoredByInfoDengue)).toEqual([true, false]);
  });
});

describe("GET /api/regions", () => {
  it("is public and returns coordinates as numbers", async () => {
    // O Prisma devolve DECIMAL como objeto; simulamos com um objeto que converte para número.
    const decimal = (v: number) => ({ toString: () => String(v), valueOf: () => v });
    db.region.findMany.mockResolvedValue([
      { id: "r1", name: "Anápolis", uf: "GO", ibgeCode: "5201108", latitude: decimal(-16.32866), longitude: decimal(-48.95295) },
    ]);

    const res = await request(app).get("/api/regions?uf=GO").expect(200);

    expect(res.body[0].latitude).toBe(-16.32866);
    expect(typeof res.body[0].longitude).toBe("number");
    expect(db.region.findMany.mock.calls[0][0].where).toEqual({ uf: "GO" });
  });

  it("rejects an invalid uf", async () => {
    await request(app).get("/api/regions?uf=XX").expect(400);
  });
});

describe("POST /api/sync/infodengue", () => {
  beforeEach(() => {
    resetSyncStatus();
    db.region.findMany.mockResolvedValue([{ id: "r1", name: "Anápolis", uf: "GO", ibgeCode: "5201108" }]);
    db.disease.findMany.mockResolvedValue([{ id: "d1", name: "Dengue", infoDengueKey: "dengue" }]);
  });

  it("requires authentication", async () => {
    await request(app).post("/api/sync/infodengue").expect(401);
  });

  it("is ADMIN-only", async () => {
    await request(app).post("/api/sync/infodengue").set("Authorization", bearer("citizen", "CITIZEN")).expect(403);
  });

  const admin = () => bearer("admin", "ADMIN");

  it("starts in the background (202) and reports the result in /status", async () => {
    (fetchAlertCity as jest.Mock).mockResolvedValue([
      { epiWeekCode: 202640, cases: 5, estimatedCases: 6, incidencePer100k: 1.2, alertLevel: 1 },
    ]);

    const started = await request(app).post("/api/sync/infodengue").set("Authorization", admin()).send({ weeks: 2 }).expect(202);
    expect(started.body).toMatchObject({ running: true, trigger: "manual", weeks: 2 });

    await waitForSync();

    const res = await request(app).get("/api/sync/infodengue/status").set("Authorization", admin()).expect(200);
    expect(res.body.running).toBe(false);
    expect(res.body.lastReport).toMatchObject({ pairs: 1, recordsUpserted: 1, failures: [] });
  });

  it("refuses a second run while one is in progress (409)", async () => {
    let finish!: () => void;
    (fetchAlertCity as jest.Mock).mockReturnValue(new Promise((resolve) => (finish = () => resolve([]))));

    await request(app).post("/api/sync/infodengue").set("Authorization", admin()).send({}).expect(202);
    const second = await request(app).post("/api/sync/infodengue").set("Authorization", admin()).send({}).expect(409);
    expect(second.body.status.running).toBe(true);

    finish();
    await waitForSync();
    await request(app).post("/api/sync/infodengue").set("Authorization", admin()).send({}).expect(202);
    await waitForSync();
  });

  it("keeps partial failures in the report", async () => {
    (fetchAlertCity as jest.Mock).mockRejectedValue(new Error("HTTP 503"));

    await request(app).post("/api/sync/infodengue").set("Authorization", admin()).send({ weeks: 1 }).expect(202);
    await waitForSync();

    const res = await request(app).get("/api/sync/infodengue/status").set("Authorization", admin()).expect(200);
    expect(res.body.lastReport.failures).toHaveLength(1);
  });

  it("records an error that stops the whole run", async () => {
    db.region.findMany.mockRejectedValue(new Error("database is down"));

    await request(app).post("/api/sync/infodengue").set("Authorization", admin()).send({}).expect(202);
    await waitForSync();

    const res = await request(app).get("/api/sync/infodengue/status").set("Authorization", admin()).expect(200);
    expect(res.body).toMatchObject({ running: false, lastError: "database is down" });
  });

  it("status is ADMIN-only", async () => {
    await request(app).get("/api/sync/infodengue/status").set("Authorization", bearer("citizen", "CITIZEN")).expect(403);
  });

  it("validates the number of weeks", async () => {
    await request(app)
      .post("/api/sync/infodengue")
      .set("Authorization", bearer("admin", "ADMIN"))
      .send({ weeks: 500 })
      .expect(400);
  });
});
