import { prisma } from "../config/prisma";
import { fetchAlertCity, InfoDengueDisease } from "../integrations/infodengue.client";
import { epiWeekStart, fromEpiWeekCode, toEpiWeek } from "../utils/epi-week";

export const INFODENGUE_SOURCE = "InfoDengue";

const DAY_MS = 24 * 60 * 60 * 1000;
// Pausa entre chamadas, para não sobrecarregar um serviço público e gratuito.
const REQUEST_GAP_MS = 300;

export interface SyncFailure {
  region: string;
  disease: string;
  reason: string;
}

export interface SyncReport {
  fromEpiWeek: number;
  toEpiWeek: number;
  pairs: number;
  recordsUpserted: number;
  failures: SyncFailure[];
  startedAt: string;
  finishedAt: string;
}

interface SyncOptions {
  weeks: number;
  now?: Date;
  gapMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Busca no InfoDengue as últimas `weeks` semanas epidemiológicas de cada par
 * (município com código IBGE × doença coberta pelo InfoDengue) e grava em
 * EpidemiologicalRecord. É idempotente: reexecutar atualiza as mesmas linhas
 * (o InfoDengue revisa as estimativas das semanas recentes).
 * Uma falha num par é registrada no relatório e não interrompe os demais.
 */
export async function syncInfoDengue({ weeks, now = new Date(), gapMs = REQUEST_GAP_MS }: SyncOptions): Promise<SyncReport> {
  const startedAt = new Date().toISOString();
  const to = toEpiWeek(now);
  const from = toEpiWeek(new Date(now.getTime() - (weeks - 1) * 7 * DAY_MS));

  const [regions, diseases] = await Promise.all([
    prisma.region.findMany({ where: { ibgeCode: { not: null } } }),
    prisma.disease.findMany({ where: { infoDengueKey: { not: null } } }),
  ]);

  const report: SyncReport = {
    fromEpiWeek: from.year * 100 + from.week,
    toEpiWeek: to.year * 100 + to.week,
    pairs: regions.length * diseases.length,
    recordsUpserted: 0,
    failures: [],
    startedAt,
    finishedAt: startedAt,
  };

  let first = true;
  for (const region of regions) {
    for (const disease of diseases) {
      if (!first) await sleep(gapMs);
      first = false;

      try {
        const rows = await fetchAlertCity(
          region.ibgeCode as string,
          disease.infoDengueKey as InfoDengueDisease,
          from,
          to
        );
        for (const row of rows) {
          const recordDate = epiWeekStart(fromEpiWeekCode(row.epiWeekCode));
          const values = {
            epiWeek: row.epiWeekCode,
            caseCount: row.cases,
            estimatedCases: row.estimatedCases,
            incidencePer100k: row.incidencePer100k,
            alertLevel: row.alertLevel,
          };
          await prisma.epidemiologicalRecord.upsert({
            where: {
              diseaseId_regionId_recordDate_source: {
                diseaseId: disease.id,
                regionId: region.id,
                recordDate,
                source: INFODENGUE_SOURCE,
              },
            },
            create: { diseaseId: disease.id, regionId: region.id, recordDate, source: INFODENGUE_SOURCE, ...values },
            update: values,
          });
          report.recordsUpserted += 1;
        }
      } catch (error) {
        report.failures.push({
          region: `${region.name}/${region.uf}`,
          disease: disease.name,
          reason: (error as Error).message,
        });
      }
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
}
