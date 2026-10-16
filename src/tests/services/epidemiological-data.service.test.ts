import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import {
  AEDES_RECOMMENDATIONS,
  getAlerts,
  getSummary,
  severityFromAlertLevel,
} from "../../services/epidemiological-data.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    epidemiologicalRecord: { findMany: jest.fn() },
    caseNotification: { findMany: jest.fn() },
  },
}));

const db = prisma as unknown as {
  epidemiologicalRecord: { findMany: jest.Mock };
  caseNotification: { findMany: jest.Mock };
};

const anapolis = {
  id: "r-ana",
  name: "Anápolis",
  uf: "GO",
  latitude: new Prisma.Decimal("-16.328660"),
  longitude: new Prisma.Decimal("-48.952950"),
};
const goiania = { id: "r-gyn", name: "Goiânia", uf: "GO", latitude: null, longitude: null };
const dengue = { id: "d-den", name: "Dengue" };
const zika = { id: "d-zik", name: "Zika" };

const record = (
  region: typeof anapolis | typeof goiania,
  disease: typeof dengue,
  date: string,
  caseCount: number,
  extra: Partial<{ alertLevel: number | null; estimatedCases: number | null; source: string; epiWeek: number | null }> = {}
) => ({
  recordDate: new Date(`${date}T00:00:00.000Z`),
  epiWeek: 202640,
  caseCount,
  estimatedCases: null,
  alertLevel: null,
  source: "InfoDengue",
  region,
  disease,
  ...extra,
});

const period = {
  startDate: new Date("2026-08-16T00:00:00.000Z"),
  endDate: new Date("2026-10-10T00:00:00.000Z"),
};

beforeEach(() => {
  jest.clearAllMocks();
  db.caseNotification.findMany.mockResolvedValue([]);
});

describe("severityFromAlertLevel", () => {
  it("maps InfoDengue levels 1–4 and nothing else", () => {
    expect([1, 2, 3, 4].map(severityFromAlertLevel)).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(severityFromAlertLevel(null)).toBeNull();
    expect(severityFromAlertLevel(7)).toBeNull();
  });
});

describe("getSummary", () => {
  it("sums cases per municipality × disease and takes severity from the latest week", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([
      record(anapolis, dengue, "2026-09-27", 10, { alertLevel: 4, estimatedCases: 12.4, epiWeek: 202639 }),
      record(anapolis, dengue, "2026-10-04", 6, { alertLevel: 2, estimatedCases: 7.3, epiWeek: 202640 }),
    ]);

    const { items } = await getSummary(period);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      regionName: "Anápolis",
      latitude: -16.32866,
      longitude: -48.95295,
      totalCases: 16,
      estimatedCases: 20,
      latestAlertLevel: 2,
      latestEpiWeek: 202640,
      latestWeekStart: "2026-10-04",
      severity: "MEDIUM",
      sources: ["InfoDengue"],
      includesDemoData: false,
    });
  });

  it("has no severity for data without an alert level and flags demo data", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([
      record(goiania, zika, "2026-09-01", 4, { source: "[FICTÍCIO] Hospital Regional", epiWeek: null }),
    ]);

    const [item] = (await getSummary(period)).items;

    expect(item.severity).toBeNull();
    expect(item.estimatedCases).toBeNull();
    expect(item.includesDemoData).toBe(true);
    expect(item.latitude).toBeNull();
  });

  it("adds Daery case notifications without double-counting them as external cases", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([record(anapolis, dengue, "2026-10-04", 6, { alertLevel: 3 })]);
    db.caseNotification.findMany.mockResolvedValue([
      { status: "CONFIRMED", region: anapolis, disease: dengue },
      { status: "SUSPECTED", region: anapolis, disease: dengue },
      { status: "DISCARDED", region: anapolis, disease: dengue },
      { status: "DEATH", region: anapolis, disease: dengue },
      { status: "SUSPECTED", region: goiania, disease: zika },
    ]);

    const { items } = await getSummary(period, { fullPlatformReports: true });

    const ana = items.find((i) => i.regionId === "r-ana")!;
    expect(ana.totalCases).toBe(6);
    expect(ana.platformReports).toEqual({ suspected: 1, confirmed: 1, deaths: 1, suppressed: false });
    // Município só com notificações do Daery também aparece.
    expect(items.find((i) => i.regionId === "r-gyn")?.platformReports.suspected).toBe(1);
  });

  it("hides counts from 1 to 4 from the public, but keeps zeros and counts of 5 or more", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([]);
    db.caseNotification.findMany.mockResolvedValue([
      ...Array.from({ length: 6 }, () => ({ status: "SUSPECTED", region: anapolis, disease: dengue })),
      { status: "DEATH", region: anapolis, disease: dengue },
    ]);

    const [publicItem] = (await getSummary(period)).items;
    expect(publicItem.platformReports).toEqual({ suspected: 6, confirmed: 0, deaths: null, suppressed: true });

    const [fullItem] = (await getSummary(period, { fullPlatformReports: true })).items;
    expect(fullItem.platformReports).toEqual({ suspected: 6, confirmed: 0, deaths: 1, suppressed: false });
  });

  it("orders by severity, then by number of cases", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([
      record(goiania, dengue, "2026-10-04", 500, { alertLevel: 2 }),
      record(anapolis, dengue, "2026-10-04", 5, { alertLevel: 4 }),
      record(anapolis, zika, "2026-10-04", 900),
    ]);

    const { items } = await getSummary(period);

    expect(items.map((i) => `${i.regionName}/${i.diseaseName}`)).toEqual([
      "Anápolis/Dengue",
      "Goiânia/Dengue",
      "Anápolis/Zika",
    ]);
  });

  it("applies the filters and an inclusive end date to both sources", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([]);

    const result = await getSummary({ ...period, uf: "GO", diseaseId: "d-den" });

    expect(db.epidemiologicalRecord.findMany.mock.calls[0][0].where).toEqual({
      region: { uf: "GO" },
      diseaseId: "d-den",
      recordDate: { gte: period.startDate, lte: period.endDate },
    });
    expect(db.caseNotification.findMany.mock.calls[0][0].where).toEqual({
      region: { uf: "GO" },
      diseaseId: "d-den",
      deletedAt: null,
      notificationDate: { gte: period.startDate, lt: new Date("2026-10-11T00:00:00.000Z") },
    });
    expect(result.period).toEqual({ startDate: "2026-08-16", endDate: "2026-10-10" });
  });
});

describe("getAlerts", () => {
  const NOW = new Date("2026-10-09T12:00:00.000Z");

  it("alerts on the latest week when its level reaches the threshold", async () => {
    // Ordem decrescente de data, como na consulta real.
    db.epidemiologicalRecord.findMany.mockResolvedValue([
      record(anapolis, dengue, "2026-10-04", 30, { alertLevel: 4, epiWeek: 202640 }),
      record(anapolis, dengue, "2026-09-27", 20, { alertLevel: 3, epiWeek: 202639 }),
    ]);

    const alerts = await getAlerts({ minLevel: 3, weeks: 4 }, NOW);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      id: "r-ana:d-den:202640",
      regionName: "Anápolis",
      alertLevel: 4,
      severity: "CRITICAL",
      weekStart: "2026-10-04",
      title: "Dengue em Anápolis/GO: incidência alta",
      latitude: -16.32866,
      source: "InfoDengue",
      isDemo: false,
    });
    expect(alerts[0].recommendations).toEqual(AEDES_RECOMMENDATIONS);
  });

  it("does not alert when the situation has already dropped below the threshold", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([
      record(anapolis, dengue, "2026-10-04", 3, { alertLevel: 2 }),
      record(anapolis, dengue, "2026-09-27", 40, { alertLevel: 4 }),
    ]);

    expect(await getAlerts({ minLevel: 3, weeks: 4 }, NOW)).toEqual([]);
  });

  it("uses demo data only when flagged, and prefers real data for the same place", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([
      record(anapolis, dengue, "2026-10-04", 70, { alertLevel: 4, source: "[FICTÍCIO] Secretaria de Saúde" }),
      record(anapolis, dengue, "2026-09-27", 20, { alertLevel: 3 }),
      record(goiania, dengue, "2026-10-04", 90, { alertLevel: 3, source: "[FICTÍCIO] Secretaria Estadual" }),
    ]);

    const alerts = await getAlerts({ minLevel: 3, weeks: 4 }, NOW);

    expect(alerts.find((a) => a.regionId === "r-ana")).toMatchObject({ alertLevel: 3, source: "InfoDengue", isDemo: false });
    expect(alerts.find((a) => a.regionId === "r-gyn")).toMatchObject({ source: "[FICTÍCIO] Secretaria Estadual", isDemo: true });
  });

  it("queries InfoDengue and demo rows with an alert level inside the window", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([]);

    await getAlerts({ minLevel: 3, weeks: 2, uf: "GO" }, NOW);

    expect(db.epidemiologicalRecord.findMany.mock.calls[0][0].where).toEqual({
      region: { uf: "GO" },
      OR: [{ source: "InfoDengue" }, { source: { startsWith: "[FICTÍCIO]" } }],
      alertLevel: { not: null },
      recordDate: { gte: new Date("2026-09-25T12:00:00.000Z") },
    });
  });

  it("sorts the most severe alerts first", async () => {
    db.epidemiologicalRecord.findMany.mockResolvedValue([
      record(goiania, dengue, "2026-10-04", 10, { alertLevel: 3 }),
      record(anapolis, dengue, "2026-10-04", 10, { alertLevel: 4 }),
    ]);

    const alerts = await getAlerts({ minLevel: 3, weeks: 4 }, NOW);

    expect(alerts.map((a) => a.alertLevel)).toEqual([4, 3]);
  });
});
