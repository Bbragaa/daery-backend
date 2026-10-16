import { fetchAlertCity, InfoDengueError } from "../../integrations/infodengue.client";

const fetchMock = jest.fn();
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
beforeEach(() => fetchMock.mockReset());

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

// Linha no formato do exemplo JSON da documentação (Curitiba, SE 201741).
const documentedRow = {
  Localidade_id: 0,
  SE: 201741,
  casos: 22,
  casos_est: 22,
  casos_est_max: 22,
  casos_est_min: 22,
  data_iniSE: 1507420800000,
  id: 4106902020174117533,
  nivel: 1,
  p_inc100k: 1.16156,
  p_rt1: 0.477252,
  versao_modelo: "2018-01-02",
};

describe("fetchAlertCity", () => {
  it("sends every mandatory parameter of the alertcity endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await fetchAlertCity("5201108", "dengue", { year: 2026, week: 30 }, { year: 2026, week: 41 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://info.dengue.mat.br/api/alertcity");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      geocode: "5201108",
      disease: "dengue",
      format: "json",
      ew_start: "30",
      ew_end: "41",
      ey_start: "2026",
      ey_end: "2026",
    });
  });

  it("normalizes the documented JSON format", async () => {
    fetchMock.mockResolvedValue(jsonResponse([documentedRow]));

    const [week] = await fetchAlertCity("4106902", "dengue", { year: 2017, week: 1 }, { year: 2017, week: 50 });

    expect(week).toEqual({
      epiWeekCode: 201741,
      cases: 22,
      estimatedCases: 22,
      incidencePer100k: 1.16156,
      alertLevel: 1,
    });
  });

  it("accepts the alternative lowercase column names also shown in the documentation", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ se: 201724, casos: 1, casos_est: 1, inc: 0.18, nivel: 2 }]));

    const [week] = await fetchAlertCity("3304557", "dengue", { year: 2017, week: 1 }, { year: 2017, week: 50 });

    expect(week).toMatchObject({ epiWeekCode: 201724, incidencePer100k: 0.18, alertLevel: 2 });
  });

  it("drops an alert level outside 1–4 instead of storing an invalid value", async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ ...documentedRow, nivel: 9 }]));

    const [week] = await fetchAlertCity("4106902", "dengue", { year: 2017, week: 1 }, { year: 2017, week: 50 });

    expect(week.alertLevel).toBeNull();
  });

  it.each([
    ["an HTTP error", () => jsonResponse({}, 503)],
    ["a non-JSON body", () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("x"); } }) as unknown as Response],
    ["an unexpected shape", () => jsonResponse({ error: "boom" })],
    ["rows without epidemiological week", () => jsonResponse([{ casos: 3 }])],
  ])("throws InfoDengueError on %s", async (_label, makeResponse) => {
    fetchMock.mockResolvedValue(makeResponse());

    await expect(
      fetchAlertCity("5201108", "dengue", { year: 2026, week: 1 }, { year: 2026, week: 2 })
    ).rejects.toBeInstanceOf(InfoDengueError);
  });

  it("throws InfoDengueError when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      fetchAlertCity("5201108", "dengue", { year: 2026, week: 1 }, { year: 2026, week: 2 })
    ).rejects.toThrow("Request failed: ECONNRESET");
  });
});
