import { RiskLevel } from "@prisma/client";
import { epiWeekStart, toEpiWeek, toEpiWeekCode } from "../utils/epi-week";

const DAY_MS = 24 * 60 * 60 * 1000;

// Catálogo inicial. Doenças, descrições, categorias, níveis de risco, cidades e
// dados de teste vêm do pacote "Daery_Banco_de_Dados" da equipe (sql/03_dados_teste.sql),
// adaptados ao schema Prisma. Códigos IBGE conferidos em fontes do IBGE;
// coordenadas aproximadas da sede municipal.

export interface SeedDisease {
  name: string;
  description: string;
  category: string;
  riskLevel: RiskLevel;
  icdCode: string | null;
  infoDengueKey: "dengue" | "chikungunya" | "zika" | null;
}

export const DISEASES: SeedDisease[] = [
  {
    name: "Dengue",
    description: "Doença viral transmitida principalmente por mosquitos do gênero Aedes.",
    category: "viral",
    riskLevel: "HIGH",
    icdCode: "A90",
    infoDengueKey: "dengue",
  },
  {
    name: "Chikungunya",
    description: "Doença viral transmitida principalmente por mosquitos do gênero Aedes.",
    category: "viral",
    riskLevel: "HIGH",
    icdCode: "A92.0",
    infoDengueKey: "chikungunya",
  },
  {
    // A92.8 é o código usado na notificação brasileira e pelo InfoDengue para Zika.
    name: "Zika",
    description: "Doença viral transmitida principalmente por mosquitos do gênero Aedes.",
    category: "viral",
    riskLevel: "MEDIUM",
    icdCode: "A92.8",
    infoDengueKey: "zika",
  },
  {
    name: "COVID-19",
    description: "Doença infecciosa causada pelo coronavírus SARS-CoV-2.",
    category: "viral",
    riskLevel: "CRITICAL",
    icdCode: "U07.1",
    infoDengueKey: null,
  },
  {
    name: "Gripe",
    description: "Infecção respiratória causada por vírus influenza.",
    category: "respiratoria",
    riskLevel: "LOW",
    icdCode: null,
    infoDengueKey: null,
  },
];

export interface SeedRegion {
  name: string;
  uf: string;
  ibgeCode: string;
  latitude: number;
  longitude: number;
}

export const REGIONS: SeedRegion[] = [
  { name: "Anápolis", uf: "GO", ibgeCode: "5201108", latitude: -16.32866, longitude: -48.95295 },
  { name: "Goiânia", uf: "GO", ibgeCode: "5208707", latitude: -16.67931, longitude: -49.25645 },
  { name: "Campinas", uf: "SP", ibgeCode: "3509502", latitude: -22.90906, longitude: -47.06455 },
  { name: "Rio de Janeiro", uf: "RJ", ibgeCode: "3304557", latitude: -22.9068, longitude: -43.1729 },
  { name: "Belo Horizonte", uf: "MG", ibgeCode: "3106200", latitude: -19.9167, longitude: -43.9345 },
  { name: "Salvador", uf: "BA", ibgeCode: "2927408", latitude: -12.9714, longitude: -38.5014 },
];

/** Prefixo obrigatório na fonte de qualquer dado inventado, para nunca se confundir com dado real. */
export const DEMO_SOURCE_PREFIX = "[FICTÍCIO]";

// Séries semanais fictícias, da semana mais antiga para a mais recente.
// As datas são calculadas a partir do dia em que o seed roda (últimas DEMO_WEEKS semanas
// epidemiológicas completas), para que o mapa e os alertas tenham dados no período padrão
// da API. O nível de alerta segue a escala do InfoDengue (1 a 4) só nas doenças que ele cobre;
// COVID-19 e Gripe ficam sem nível, como ficariam com dados reais.
export const DEMO_WEEKS = 8;

export interface DemoSeries {
  disease: string;
  region: string;
  source: string;
  weeklyCases: number[];
  alertLevels: (number | null)[];
}

const NO_LEVEL = Array<null>(DEMO_WEEKS).fill(null);

export const DEMO_SERIES: DemoSeries[] = [
  // Crescimento até o nível 4: gera alerta crítico.
  { disease: "Dengue", region: "Anápolis", source: "Secretaria de Saúde", weeklyCases: [12, 15, 19, 26, 34, 45, 58, 72], alertLevels: [1, 1, 2, 2, 3, 3, 4, 4] },
  // Transmissão sustentada: alerta alto.
  { disease: "Dengue", region: "Goiânia", source: "Secretaria Estadual", weeklyCases: [80, 92, 101, 115, 130, 142, 150, 161], alertLevels: [2, 2, 2, 3, 3, 3, 3, 3] },
  { disease: "Chikungunya", region: "Goiânia", source: "Secretaria Estadual", weeklyCases: [3, 4, 2, 5, 6, 4, 5, 7], alertLevels: [1, 1, 1, 1, 1, 1, 1, 1] },
  { disease: "Chikungunya", region: "Campinas", source: "Unidade de Vigilância", weeklyCases: [10, 12, 14, 13, 16, 18, 17, 19], alertLevels: [2, 2, 2, 2, 2, 2, 2, 2] },
  // Já esteve alto e baixou: não gera alerta (a regra olha a semana mais recente).
  { disease: "Dengue", region: "Rio de Janeiro", source: "Secretaria Estadual", weeklyCases: [60, 55, 51, 48, 40, 35, 31, 28], alertLevels: [3, 3, 3, 2, 2, 2, 2, 2] },
  { disease: "Zika", region: "Belo Horizonte", source: "Hospital Regional", weeklyCases: [2, 3, 2, 1, 2, 3, 2, 2], alertLevels: [1, 1, 1, 1, 1, 1, 1, 1] },
  { disease: "Chikungunya", region: "Salvador", source: "Secretaria Municipal", weeklyCases: [20, 24, 29, 33, 38, 41, 47, 52], alertLevels: [2, 2, 2, 3, 3, 3, 3, 3] },
  { disease: "COVID-19", region: "Campinas", source: "Ministério da Saúde", weeklyCases: [40, 38, 35, 30, 28, 25, 22, 20], alertLevels: NO_LEVEL },
  { disease: "Gripe", region: "Campinas", source: "Unidade de Vigilância", weeklyCases: [15, 18, 22, 25, 24, 20, 17, 14], alertLevels: NO_LEVEL },
];

export interface DemoRecord {
  disease: string;
  region: string;
  /** Domingo que inicia a semana epidemiológica. */
  recordDate: Date;
  epiWeek: number;
  caseCount: number;
  alertLevel: number | null;
  source: string;
}

/**
 * Converte as séries em registros semanais. A semana mais recente é a última semana
 * epidemiológica completa antes de `now` (a semana corrente ainda não fechou).
 */
export function buildDemoRecords(now: Date = new Date()): DemoRecord[] {
  const lastWeekStart = epiWeekStart(toEpiWeek(new Date(now.getTime() - 7 * DAY_MS)));
  return DEMO_SERIES.flatMap((series) =>
    series.weeklyCases.map((caseCount, index) => {
      const weeksBeforeLast = series.weeklyCases.length - 1 - index;
      const recordDate = new Date(lastWeekStart.getTime() - weeksBeforeLast * 7 * DAY_MS);
      return {
        disease: series.disease,
        region: series.region,
        recordDate,
        epiWeek: toEpiWeekCode(toEpiWeek(recordDate)),
        caseCount,
        alertLevel: series.alertLevels[index],
        source: `${DEMO_SOURCE_PREFIX} ${series.source}`,
      };
    })
  );
}
