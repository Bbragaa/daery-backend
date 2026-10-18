import { prisma } from "../../config/prisma";
import { fetchAlertCity } from "../../integrations/infodengue.client";
import { INFODENGUE_SOURCE, syncInfoDengue } from "../../services/epidemiological-sync.service";

jest.mock("../../config/prisma", () => ({
  prisma: {
    region: { findMany: jest.fn() },
    disease: { findMany: jest.fn() },
    epidemiologicalRecord: { upsert: jest.fn() },
  },
}));
jest.mock("../../integrations/infodengue.client", () => ({ fetchAlertCity: jest.fn() }));

const db = prisma as unknown as {
  region: { findMany: jest.Mock };
  disease: { findMany: jest.Mock };
  epidemiologicalRecord: { upsert: jest.Mock };
};
const fetchMock = fetchAlertCity as jest.Mock;

const regions = [
  { id: "r-ana", name: "Anápolis", uf: "GO", ibgeCode: "5201108" },
  { id: "r-gyn", name: "Goiânia", uf: "GO", ibgeCode: "5208707" },
];
const diseases = [
  { id: "d-den", name: "Dengue", infoDengueKey: "dengue" },
  { id: "d-chi", name: "Chikungunya", infoDengueKey: "chikungunya" },
];
const week = (code: number, cases: number) => ({
  epiWeekCode: code,
  cases,
  estimatedCases: cases + 1,
  incidencePer100k: 1.5,
  alertLevel: 2,
});

// 9 de outubro de 2026 (sexta) está na SE 202640.
const NOW = new Date("2026-10-09T12:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  db.region.findMany.mockResolvedValue(regions);
  db.disease.findMany.mockResolvedValue(diseases);
  db.epidemiologicalRecord.upsert.mockResolvedValue({});
});

it("only syncs regions with IBGE code and diseases covered by InfoDengue", async () => {
  fetchMock.mockResolvedValue([]);

  await syncInfoDengue({ weeks: 4, now: NOW, gapMs: 0 });

  expect(db.region.findMany).toHaveBeenCalledWith({ where: { ibgeCode: { not: null } } });
  expect(db.disease.findMany).toHaveBeenCalledWith({ where: { infoDengueKey: { not: null } } });
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it("requests the last N epidemiological weeks", async () => {
  fetchMock.mockResolvedValue([]);

  const report = await syncInfoDengue({ weeks: 4, now: NOW, gapMs: 0 });

  expect(report.toEpiWeek).toBe(202640);
  expect(report.fromEpiWeek).toBe(202637);
  expect(fetchMock).toHaveBeenCalledWith("5201108", "dengue", { year: 2026, week: 37 }, { year: 2026, week: 40 });
});

it("upserts each week keyed by disease, region, week start and source", async () => {
  fetchMock.mockResolvedValue([week(202640, 7)]);

  await syncInfoDengue({ weeks: 1, now: NOW, gapMs: 0 });

  const call = db.epidemiologicalRecord.upsert.mock.calls[0][0];
  expect(call.where.diseaseId_regionId_recordDate_source).toEqual({
    diseaseId: "d-den",
    regionId: "r-ana",
    recordDate: new Date("2026-10-04T00:00:00.000Z"), // domingo que abre a SE 40
    source: INFODENGUE_SOURCE,
  });
  expect(call.create).toMatchObject({ epiWeek: 202640, caseCount: 7, alertLevel: 2 });
  expect(call.update).toEqual({
    epiWeek: 202640,
    caseCount: 7,
    estimatedCases: 8,
    incidencePer100k: 1.5,
    alertLevel: 2,
  });
});

it("keeps going when one pair fails and reports the failure", async () => {
  fetchMock
    .mockResolvedValueOnce([week(202640, 1), week(202639, 2)])
    .mockRejectedValueOnce(new Error("HTTP 503"))
    .mockResolvedValueOnce([week(202640, 3)])
    .mockResolvedValueOnce([]);

  const report = await syncInfoDengue({ weeks: 2, now: NOW, gapMs: 0 });

  expect(report.pairs).toBe(4);
  expect(report.recordsUpserted).toBe(3);
  expect(report.failures).toEqual([{ region: "Anápolis/GO", disease: "Chikungunya", reason: "HTTP 503" }]);
});
