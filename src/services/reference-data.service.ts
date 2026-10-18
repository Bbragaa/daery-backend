import { Disease, Region } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface RegionDto {
  id: string;
  name: string;
  uf: string;
  ibgeCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface DiseaseDto extends Omit<Disease, "infoDengueKey"> {
  /** true quando a doença recebe dados automáticos do InfoDengue. */
  monitoredByInfoDengue: boolean;
}

// O Prisma devolve DECIMAL como objeto Decimal (serializado como string no JSON);
// o mapa precisa de números.
function toRegionDto(region: Region): RegionDto {
  return {
    id: region.id,
    name: region.name,
    uf: region.uf,
    ibgeCode: region.ibgeCode,
    latitude: region.latitude === null ? null : Number(region.latitude),
    longitude: region.longitude === null ? null : Number(region.longitude),
  };
}

function toDiseaseDto(disease: Disease): DiseaseDto {
  const { infoDengueKey, ...rest } = disease;
  return { ...rest, monitoredByInfoDengue: infoDengueKey !== null };
}

export async function listDiseases(): Promise<DiseaseDto[]> {
  const diseases = await prisma.disease.findMany({ orderBy: { name: "asc" } });
  return diseases.map(toDiseaseDto);
}

export async function listRegions(uf?: string): Promise<RegionDto[]> {
  const regions = await prisma.region.findMany({
    where: uf ? { uf } : undefined,
    orderBy: [{ uf: "asc" }, { name: "asc" }],
  });
  return regions.map(toRegionDto);
}
