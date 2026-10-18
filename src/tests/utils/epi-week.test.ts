import { epiWeekStart, fromEpiWeekCode, toEpiWeek, toEpiWeekCode } from "../../utils/epi-week";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("toEpiWeek", () => {
  // Pares (data de início da SE, código da SE) tirados da documentação da API do InfoDengue.
  it.each([
    ["2017-01-01", 201701],
    ["2017-06-11", 201724],
    ["2017-08-13", 201733],
    ["2017-10-08", 201741],
    ["2017-11-26", 201748],
  ])("matches the InfoDengue example %s → %i", (date, code) => {
    expect(toEpiWeekCode(toEpiWeek(utc(date)))).toBe(code);
  });

  it("assigns the first days of January to the previous year when needed", () => {
    // 4 de janeiro de 2026 é domingo: 1º a 3/01/2026 ainda são da SE 53 de 2025.
    expect(toEpiWeek(utc("2026-01-03"))).toEqual({ year: 2025, week: 53 });
    expect(toEpiWeek(utc("2026-01-04"))).toEqual({ year: 2026, week: 1 });
  });

  it("assigns the last days of December to the next year when needed", () => {
    // 4 de janeiro de 2025 é sábado: a SE 1 de 2025 começa em 29/12/2024.
    expect(toEpiWeek(utc("2024-12-29"))).toEqual({ year: 2025, week: 1 });
    expect(toEpiWeek(utc("2024-12-28"))).toEqual({ year: 2024, week: 52 });
  });

  it("is the same for every day of a Sunday–Saturday week", () => {
    const codes = ["2026-10-04", "2026-10-07", "2026-10-10"].map((d) => toEpiWeekCode(toEpiWeek(utc(d))));
    expect(new Set(codes).size).toBe(1);
  });
});

describe("epiWeekStart", () => {
  it("returns the Sunday that opens the week (round trip)", () => {
    expect(epiWeekStart(fromEpiWeekCode(201741)).toISOString().slice(0, 10)).toBe("2017-10-08");
    expect(epiWeekStart({ year: 2026, week: 1 }).getUTCDay()).toBe(0);
  });
});
