import {
  alertsQuerySchema,
  caseNotificationListQuerySchema,
  summaryQuerySchema,
} from "../../validations/epidemiological-data.validation";

describe("summaryQuerySchema", () => {
  it("defaults to the last 8 weeks up to today", () => {
    const parsed = summaryQuerySchema.parse({});
    const days = (parsed.endDate.getTime() - parsed.startDate.getTime()) / 86400000 + 1;
    expect(days).toBe(56);
  });

  it("parses YYYY-MM-DD dates as UTC midnight", () => {
    const parsed = summaryQuerySchema.parse({ startDate: "2026-08-01", endDate: "2026-10-09" });
    expect(parsed.startDate.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(parsed.endDate.toISOString()).toBe("2026-10-09T00:00:00.000Z");
  });

  it.each([
    [{ startDate: "2026-10-09", endDate: "2026-10-01" }, "start after end"],
    [{ startDate: "2024-01-01", endDate: "2026-01-01" }, "more than 366 days"],
    [{ startDate: "09/10/2026" }, "wrong date format"],
    [{ uf: "XX" }, "invalid UF"],
    [{ diseaseId: "not-a-uuid" }, "invalid disease id"],
    [{ foo: "bar" }, "unknown parameter"],
  ])("rejects %j (%s)", (query, _reason) => {
    expect(summaryQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("alertsQuerySchema", () => {
  it("defaults to level ≥ 3 in the last 4 weeks", () => {
    expect(alertsQuerySchema.parse({})).toEqual({ minLevel: 3, weeks: 4 });
  });

  it("coerces numbers from the query string", () => {
    expect(alertsQuerySchema.parse({ minLevel: "4", weeks: "2" })).toMatchObject({ minLevel: 4, weeks: 2 });
  });

  it("rejects levels outside 1–4", () => {
    expect(alertsQuerySchema.safeParse({ minLevel: "5" }).success).toBe(false);
  });
});

describe("caseNotificationListQuerySchema", () => {
  it("defaults to page 1 with 20 items", () => {
    expect(caseNotificationListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("caps the page size at 100", () => {
    expect(caseNotificationListQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});
