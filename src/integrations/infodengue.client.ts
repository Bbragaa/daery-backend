import { z } from "zod";
import { env } from "../config/env";
import { EpiWeek } from "../utils/epi-week";

// Cliente da API pública do InfoDengue (Fiocruz/FGV): https://info.dengue.mat.br/services/api/doc
// Endpoint `alertcity`: dados semanais de um município (código IBGE) para uma doença.
// Todos os parâmetros são obrigatórios: geocode, disease, format, ew_start, ew_end, ey_start, ey_end.

export type InfoDengueDisease = "dengue" | "chikungunya" | "zika";

export interface InfoDengueWeek {
  epiWeekCode: number; // AAAASS
  cases: number;
  estimatedCases: number | null;
  incidencePer100k: number | null;
  alertLevel: number | null; // 1 a 4
}

export class InfoDengueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InfoDengueError";
  }
}

const num = z.coerce.number();

// A documentação mostra duas grafias de colunas (ex.: `SE`/`se`, `p_inc100k`/`inc`);
// aceitamos as duas e normalizamos.
const rowSchema = z
  .object({
    SE: num.optional(),
    se: num.optional(),
    casos: num,
    casos_est: num.nullish(),
    p_inc100k: num.nullish(),
    inc: num.nullish(),
    nivel: num.nullish(),
  })
  .passthrough()
  .refine((row) => row.SE !== undefined || row.se !== undefined, "missing epidemiological week");

function normalize(row: z.infer<typeof rowSchema>): InfoDengueWeek {
  const alert = row.nivel ?? null;
  return {
    epiWeekCode: Number(row.SE ?? row.se),
    cases: Math.max(0, Math.round(row.casos)),
    estimatedCases: row.casos_est ?? null,
    incidencePer100k: row.p_inc100k ?? row.inc ?? null,
    alertLevel: alert !== null && alert >= 1 && alert <= 4 ? alert : null,
  };
}

export async function fetchAlertCity(
  geocode: string,
  disease: InfoDengueDisease,
  from: EpiWeek,
  to: EpiWeek
): Promise<InfoDengueWeek[]> {
  const params = new URLSearchParams({
    geocode,
    disease,
    format: "json",
    ew_start: String(from.week),
    ew_end: String(to.week),
    ey_start: String(from.year),
    ey_end: String(to.year),
  });
  const url = `${env.INFODENGUE_BASE_URL}/api/alertcity?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(env.INFODENGUE_TIMEOUT_MS) });
  } catch (error) {
    throw new InfoDengueError(`Request failed: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new InfoDengueError(`HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Em caso de parâmetro inválido a API devolve texto com "[EE] error_message: ...".
    throw new InfoDengueError("Response is not JSON");
  }

  const parsed = z.array(rowSchema).safeParse(body);
  if (!parsed.success) {
    throw new InfoDengueError("Unexpected response format");
  }
  return parsed.data.map(normalize);
}
