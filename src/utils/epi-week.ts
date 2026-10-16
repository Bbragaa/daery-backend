// Semana epidemiológica (SE) no padrão usado pelo Ministério da Saúde / SINAN:
// semanas de domingo a sábado; a SE 1 de um ano é a semana que contém 4 de janeiro
// (ou seja, a primeira semana com pelo menos quatro dias naquele ano).
// Todas as contas são feitas em UTC para não depender do fuso do servidor.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EpiWeek {
  year: number;
  week: number;
}

/** Domingo (UTC) que inicia a SE 1 do ano informado. */
export function epiYearStart(year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return new Date(jan4.getTime() - jan4.getUTCDay() * DAY_MS);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toEpiWeek(date: Date): EpiWeek {
  const day = startOfUtcDay(date);
  let year = day.getUTCFullYear();
  if (day >= epiYearStart(year + 1)) {
    year += 1;
  } else if (day < epiYearStart(year)) {
    year -= 1;
  }
  const week = Math.floor((day.getTime() - epiYearStart(year).getTime()) / (7 * DAY_MS)) + 1;
  return { year, week };
}

/** Domingo (UTC) em que começa a SE informada. */
export function epiWeekStart({ year, week }: EpiWeek): Date {
  return new Date(epiYearStart(year).getTime() + (week - 1) * 7 * DAY_MS);
}

/** { year: 2026, week: 5 } → 202605 */
export function toEpiWeekCode({ year, week }: EpiWeek): number {
  return year * 100 + week;
}

/** 202605 → { year: 2026, week: 5 } */
export function fromEpiWeekCode(code: number): EpiWeek {
  return { year: Math.floor(code / 100), week: code % 100 };
}
