import { buildDemoRecords, DEMO_SERIES, DEMO_SOURCE_PREFIX, DEMO_WEEKS, DISEASES, REGIONS } from "../../database/seed-data";
import { toEpiWeek } from "../../utils/epi-week";

// Prefixo IBGE de cada UF usada no seed.
const UF_PREFIX: Record<string, string> = { GO: "52", SP: "35", RJ: "33", MG: "31", BA: "29" };

describe("seed data integrity", () => {
  it("has unique disease names, ICD codes and InfoDengue keys", () => {
    const unique = (values: (string | null)[]) => {
      const present = values.filter((v): v is string => v !== null);
      return new Set(present).size === present.length;
    };
    expect(unique(DISEASES.map((d) => d.name))).toBe(true);
    expect(unique(DISEASES.map((d) => d.icdCode))).toBe(true);
    expect(unique(DISEASES.map((d) => d.infoDengueKey))).toBe(true);
  });

  it("uses 7-digit IBGE codes whose prefix matches the state", () => {
    for (const region of REGIONS) {
      expect(region.ibgeCode).toMatch(/^\d{7}$/);
      expect(region.ibgeCode.slice(0, 2)).toBe(UF_PREFIX[region.uf]);
    }
  });

  it("places every municipality inside Brazil's bounding box", () => {
    for (const region of REGIONS) {
      expect(region.latitude).toBeGreaterThan(-34);
      expect(region.latitude).toBeLessThan(6);
      expect(region.longitude).toBeGreaterThan(-74);
      expect(region.longitude).toBeLessThan(-34);
    }
  });

  it("only references diseases and regions that exist in the seed", () => {
    for (const series of DEMO_SERIES) {
      expect(DISEASES.some((d) => d.name === series.disease)).toBe(true);
      expect(REGIONS.some((r) => r.name === series.region)).toBe(true);
      expect(series.weeklyCases).toHaveLength(DEMO_WEEKS);
      expect(series.alertLevels).toHaveLength(DEMO_WEEKS);
    }
  });

  it("only gives alert levels to diseases covered by InfoDengue", () => {
    for (const series of DEMO_SERIES) {
      const covered = DISEASES.find((d) => d.name === series.disease)!.infoDengueKey !== null;
      for (const level of series.alertLevels) {
        if (covered) expect(level).toBeGreaterThanOrEqual(1);
        if (covered) expect(level).toBeLessThanOrEqual(4);
        if (!covered) expect(level).toBeNull();
      }
    }
  });
});

describe("buildDemoRecords", () => {
  // Quinta-feira 15/10/2026, na SE 41 (começa no domingo 11/10); a última semana completa é a SE 40.
  const NOW = new Date("2026-10-15T15:00:00.000Z");
  const records = buildDemoRecords(NOW);

  it("ends on the last complete epidemiological week before today", () => {
    const latest = Math.max(...records.map((r) => r.recordDate.getTime()));
    expect(new Date(latest).toISOString().slice(0, 10)).toBe("2026-10-04");
    expect(Math.max(...records.map((r) => r.epiWeek))).toBe(202640);
  });

  it("covers the last eight weeks, each starting on a Sunday", () => {
    const weeks = new Set(records.map((r) => r.recordDate.toISOString().slice(0, 10)));
    expect(weeks.size).toBe(DEMO_WEEKS);
    expect(Math.min(...records.map((r) => r.recordDate.getTime()))).toBe(Date.parse("2026-08-16T00:00:00.000Z"));
    for (const record of records) {
      expect(record.recordDate.getUTCDay()).toBe(0);
      const { year, week } = toEpiWeek(record.recordDate);
      expect(record.epiWeek).toBe(year * 100 + week);
    }
  });

  it("marks every record as fictitious", () => {
    expect(records).toHaveLength(DEMO_SERIES.length * DEMO_WEEKS);
    for (const record of records) expect(record.source.startsWith(`${DEMO_SOURCE_PREFIX} `)).toBe(true);
  });

  it("keeps the newest week last in each series", () => {
    const anapolis = records.filter((r) => r.region === "Anápolis" && r.disease === "Dengue");
    expect(anapolis.at(-1)).toMatchObject({ caseCount: 72, alertLevel: 4 });
  });
});
