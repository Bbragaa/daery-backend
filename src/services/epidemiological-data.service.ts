import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { DEMO_SOURCE_PREFIX } from "../database/seed-data";
import { AlertsQuery, SummaryQuery } from "../validations/epidemiological-data.validation";
import { INFODENGUE_SOURCE } from "./epidemiological-sync.service";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Regra de negócio: severidade e alertas (RNE012, nova; ver ADR 0005)
// A severidade vem do nível de alerta do InfoDengue da semana mais recente:
//   1 verde    → LOW       condições climáticas desfavoráveis à transmissão
//   2 amarelo  → MEDIUM    condições propícias ao vetor e à transmissão
//   3 laranja  → HIGH      transmissão aumentada e sustentada
//   4 vermelho → CRITICAL  incidência acima de 90% do histórico
// Sem nível (dados que não vêm do InfoDengue) → null: o Daery não inventa severidade.
// ---------------------------------------------------------------------------
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function severityFromAlertLevel(level: number | null): Severity | null {
  switch (level) {
    case 1:
      return "LOW";
    case 2:
      return "MEDIUM";
    case 3:
      return "HIGH";
    case 4:
      return "CRITICAL";
    default:
      return null;
  }
}

const SEVERITY_ORDER: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const toNumber = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

interface RegionInfo {
  id: string;
  name: string;
  uf: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
}

interface DiseaseInfo {
  id: string;
  name: string;
}

export interface PlatformReports {
  suspected: number;
  confirmed: number;
  deaths: number;
}

/**
 * Versão pública: contagens de 1 a 4 viram null (RNE002/LGPD). Num município pequeno,
 * "1 óbito por Zika nesta semana" pode identificar a pessoa. Zero não identifica ninguém
 * e continua visível; a partir de 5 o número aparece.
 */
export interface PublicPlatformReports {
  suspected: number | null;
  confirmed: number | null;
  deaths: number | null;
  /** true quando ao menos uma das contagens foi omitida. */
  suppressed: boolean;
}

export const SMALL_COUNT_THRESHOLD = 5;

const suppress = (count: number) => (count > 0 && count < SMALL_COUNT_THRESHOLD ? null : count);

export function suppressSmallCounts(reports: PlatformReports): PublicPlatformReports {
  const result = {
    suspected: suppress(reports.suspected),
    confirmed: suppress(reports.confirmed),
    deaths: suppress(reports.deaths),
  };
  const suppressed = result.suspected === null || result.confirmed === null || result.deaths === null;
  return { ...result, suppressed };
}

export interface SummaryItem {
  regionId: string;
  regionName: string;
  uf: string;
  latitude: number | null;
  longitude: number | null;
  diseaseId: string;
  diseaseName: string;
  /** Soma dos casos notificados nas semanas do período (fontes externas). */
  totalCases: number;
  /** Soma dos casos estimados pelo InfoDengue (corrige atraso de notificação); null sem estimativa. */
  estimatedCases: number | null;
  latestWeekStart: string | null;
  latestEpiWeek: number | null;
  latestAlertLevel: number | null;
  severity: Severity | null;
  /**
   * Casos registrados por profissionais/instituições no próprio Daery, sem dados de paciente.
   * Perfis profissionais recebem os números completos; o público, com supressão.
   */
  platformReports: PublicPlatformReports;
  sources: string[];
  includesDemoData: boolean;
}

interface SummaryAccumulator extends Omit<SummaryItem, "platformReports"> {
  platformReports: PlatformReports;
}

export interface SummaryOptions {
  /** true para perfis profissionais: contagens de casos do Daery sem supressão. */
  fullPlatformReports?: boolean;
}

export interface SummaryResponse {
  period: { startDate: string; endDate: string };
  generatedAt: string;
  items: SummaryItem[];
}

function regionWhere(filters: { regionId?: string; uf?: string }) {
  if (filters.regionId) return { regionId: filters.regionId };
  if (filters.uf) return { region: { uf: filters.uf } };
  return {};
}

const regionSelect = { select: { id: true, name: true, uf: true, latitude: true, longitude: true } };
const diseaseSelect = { select: { id: true, name: true } };

function emptyItem(region: RegionInfo, disease: DiseaseInfo): SummaryAccumulator {
  return {
    regionId: region.id,
    regionName: region.name,
    uf: region.uf,
    latitude: toNumber(region.latitude),
    longitude: toNumber(region.longitude),
    diseaseId: disease.id,
    diseaseName: disease.name,
    totalCases: 0,
    estimatedCases: null,
    latestWeekStart: null,
    latestEpiWeek: null,
    latestAlertLevel: null,
    severity: null,
    platformReports: { suspected: 0, confirmed: 0, deaths: 0 },
    sources: [],
    includesDemoData: false,
  };
}

/**
 * Resumo por município × doença no período, para o mapa e os filtros (RF-002, RF-003).
 * Só devolve dados agregados, nunca dados de paciente (RNE002), por isso é público.
 */
export async function getSummary(query: SummaryQuery, options: SummaryOptions = {}): Promise<SummaryResponse> {
  const location = regionWhere(query);
  const disease = query.diseaseId ? { diseaseId: query.diseaseId } : {};

  const [records, reports] = await Promise.all([
    prisma.epidemiologicalRecord.findMany({
      where: { ...location, ...disease, recordDate: { gte: query.startDate, lte: query.endDate } },
      select: {
        recordDate: true,
        epiWeek: true,
        caseCount: true,
        estimatedCases: true,
        alertLevel: true,
        source: true,
        region: regionSelect,
        disease: diseaseSelect,
      },
      orderBy: { recordDate: "asc" },
    }),
    prisma.caseNotification.findMany({
      where: {
        ...location,
        ...disease,
        deletedAt: null,
        notificationDate: { gte: query.startDate, lt: new Date(query.endDate.getTime() + DAY_MS) },
      },
      select: { status: true, region: regionSelect, disease: diseaseSelect },
    }),
  ]);

  const items = new Map<string, SummaryAccumulator>();
  const itemFor = (region: RegionInfo, dis: DiseaseInfo) => {
    const key = `${region.id}:${dis.id}`;
    let item = items.get(key);
    if (!item) {
      item = emptyItem(region, dis);
      items.set(key, item);
    }
    return item;
  };

  // Registros chegam em ordem cronológica: o último com nível de alerta define a situação atual.
  for (const record of records) {
    const item = itemFor(record.region, record.disease);
    item.totalCases += record.caseCount;
    if (record.estimatedCases !== null) {
      item.estimatedCases = (item.estimatedCases ?? 0) + record.estimatedCases;
    }
    if (!item.sources.includes(record.source)) item.sources.push(record.source);
    if (record.source.startsWith(DEMO_SOURCE_PREFIX)) item.includesDemoData = true;
    if (record.alertLevel !== null) {
      item.latestAlertLevel = record.alertLevel;
      item.latestWeekStart = isoDay(record.recordDate);
      item.latestEpiWeek = record.epiWeek;
    } else if (item.latestAlertLevel === null) {
      item.latestWeekStart = isoDay(record.recordDate);
      item.latestEpiWeek = record.epiWeek;
    }
  }

  for (const report of reports) {
    const item = itemFor(report.region, report.disease);
    if (report.status === "SUSPECTED") item.platformReports.suspected += 1;
    else if (report.status === "CONFIRMED") item.platformReports.confirmed += 1;
    else if (report.status === "DEATH") item.platformReports.deaths += 1;
  }

  const result: SummaryItem[] = [...items.values()].map((item) => ({
    ...item,
    estimatedCases: item.estimatedCases === null ? null : Math.round(item.estimatedCases),
    severity: severityFromAlertLevel(item.latestAlertLevel),
    platformReports: options.fullPlatformReports
      ? { ...item.platformReports, suppressed: false }
      : suppressSmallCounts(item.platformReports),
  }));

  // Mais graves primeiro; empate pelo número de casos.
  result.sort(
    (a, b) =>
      (b.severity ? SEVERITY_ORDER[b.severity] : 0) - (a.severity ? SEVERITY_ORDER[a.severity] : 0) ||
      b.totalCases - a.totalCases
  );

  return {
    period: { startDate: isoDay(query.startDate), endDate: isoDay(query.endDate) },
    generatedAt: new Date().toISOString(),
    items: result,
  };
}

// ---------------------------------------------------------------------------
// Alertas preventivos (versão mínima do RF-004, decisão D2): públicos.
// ---------------------------------------------------------------------------
export interface Alert {
  id: string;
  regionId: string;
  regionName: string;
  uf: string;
  latitude: number | null;
  longitude: number | null;
  diseaseId: string;
  diseaseName: string;
  alertLevel: number;
  severity: Severity;
  epiWeek: number | null;
  weekStart: string;
  title: string;
  message: string;
  recommendations: string[];
  source: string;
  /** true quando o alerta vem de dados fictícios de demonstração (fonte marcada [FICTÍCIO]). */
  isDemo: boolean;
}

// Orientações gerais de prevenção para doenças transmitidas pelo Aedes
// (todas as cobertas pelo InfoDengue). Não substituem orientação médica.
export const AEDES_RECOMMENDATIONS = [
  "Elimine recipientes que acumulem água parada, como pratos de plantas, pneus e garrafas.",
  "Use repelente e, se possível, telas em portas e janelas.",
  "Em caso de febre, dores no corpo ou manchas na pele, procure uma unidade de saúde.",
  "Não se automedique: medicamentos à base de ácido acetilsalicílico são contraindicados na suspeita de dengue.",
];

function alertText(level: number, disease: string, place: string) {
  if (level >= 4) {
    return {
      title: `${disease} em ${place}: incidência alta`,
      message: `A incidência de ${disease.toLowerCase()} está acima de 90% do histórico do município. Redobre os cuidados de prevenção.`,
    };
  }
  if (level === 3) {
    return {
      title: `${disease} em ${place}: transmissão aumentada`,
      message: `Há transmissão aumentada e sustentada de ${disease.toLowerCase()} no município.`,
    };
  }
  return {
    title: `${disease} em ${place}: atenção`,
    message: `As condições atuais favorecem o mosquito transmissor de ${disease.toLowerCase()}.`,
  };
}

/**
 * Para cada município × doença, pega a semana mais recente do InfoDengue dentro da janela
 * e emite alerta se o nível dela for ≥ minLevel. Uma semana antiga em nível alto não gera
 * alerta se a situação mais recente já baixou.
 */
export async function getAlerts(query: AlertsQuery, now: Date = new Date()): Promise<Alert[]> {
  const since = new Date(now.getTime() - query.weeks * 7 * DAY_MS);
  const records = await prisma.epidemiologicalRecord.findMany({
    where: {
      ...regionWhere(query),
      ...(query.diseaseId ? { diseaseId: query.diseaseId } : {}),
      // InfoDengue e, quando o seed de demonstração foi carregado, os dados fictícios.
      OR: [{ source: INFODENGUE_SOURCE }, { source: { startsWith: DEMO_SOURCE_PREFIX } }],
      alertLevel: { not: null },
      recordDate: { gte: since },
    },
    select: {
      recordDate: true,
      epiWeek: true,
      alertLevel: true,
      source: true,
      region: regionSelect,
      disease: diseaseSelect,
    },
    orderBy: { recordDate: "desc" },
  });

  const isDemo = (source: string) => source.startsWith(DEMO_SOURCE_PREFIX);

  // Ordem decrescente: o primeiro de cada município × doença é o mais recente.
  // Dado real tem prioridade: um registro fictício só vale quando não há InfoDengue no período.
  const latest = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    const key = `${record.region.id}:${record.disease.id}`;
    const chosen = latest.get(key);
    if (!chosen || (isDemo(chosen.source) && !isDemo(record.source))) latest.set(key, record);
  }

  const alerts: Alert[] = [];
  for (const record of latest.values()) {
    const level = record.alertLevel as number;
    if (level < query.minLevel) continue;
    const place = `${record.region.name}/${record.region.uf}`;
    alerts.push({
      id: `${record.region.id}:${record.disease.id}:${record.epiWeek ?? isoDay(record.recordDate)}`,
      regionId: record.region.id,
      regionName: record.region.name,
      uf: record.region.uf,
      latitude: toNumber(record.region.latitude),
      longitude: toNumber(record.region.longitude),
      diseaseId: record.disease.id,
      diseaseName: record.disease.name,
      alertLevel: level,
      severity: severityFromAlertLevel(level) as Severity,
      epiWeek: record.epiWeek,
      weekStart: isoDay(record.recordDate),
      ...alertText(level, record.disease.name, place),
      recommendations: AEDES_RECOMMENDATIONS,
      source: record.source,
      isDemo: isDemo(record.source),
    });
  }

  return alerts.sort((a, b) => b.alertLevel - a.alertLevel || a.regionName.localeCompare(b.regionName));
}
