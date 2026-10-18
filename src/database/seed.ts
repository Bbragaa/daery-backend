import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { buildDemoRecords, DEMO_SOURCE_PREFIX, DEMO_WEEKS, DISEASES, REGIONS } from "./seed-data";

// Idempotente: pode ser executado várias vezes (upsert por chave natural).
// 1. ADMIN inicial (SEED_ADMIN_*).  2. Doenças.  3. Municípios.
// 4. Registros fictícios, somente com SEED_DEMO_DATA=true.
// Dados reais vêm depois, com `npm run sync:infodengue`.
const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Administrador Daery";

  if (!email || !password || password.length < 8) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ characters) in .env");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: admin ${email} already exists, skipping.`);
    return;
  }

  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, rounds), role: "ADMIN" },
  });
  console.log(`Seed: admin ${email} created.`);
}

async function seedReferenceData() {
  for (const disease of DISEASES) {
    await prisma.disease.upsert({ where: { name: disease.name }, create: disease, update: disease });
  }
  // Chave natural nome + UF: num banco antigo o município pode existir sem código IBGE.
  // Buscar por ibgeCode tentaria criar outra linha e violaria Region_name_uf_key;
  // assim o registro existente é reaproveitado e recebe código IBGE e coordenadas.
  for (const region of REGIONS) {
    await prisma.region.upsert({
      where: { name_uf: { name: region.name, uf: region.uf } },
      create: region,
      update: region,
    });
  }
  console.log(`Seed: ${DISEASES.length} diseases and ${REGIONS.length} regions upserted.`);
}

async function seedDemoRecords() {
  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("Seed: demo records skipped (set SEED_DEMO_DATA=true to include them).");
    return;
  }

  // As datas são relativas ao dia do seed: os registros fictícios antigos saem e entram os novos.
  // Só linhas com a fonte marcada como fictícia são apagadas; dados reais não são tocados.
  const removed = await prisma.epidemiologicalRecord.deleteMany({
    where: { source: { startsWith: DEMO_SOURCE_PREFIX } },
  });

  const diseases = new Map((await prisma.disease.findMany()).map((d) => [d.name, d.id]));
  const regions = new Map((await prisma.region.findMany()).map((r) => [`${r.name}/${r.uf}`, r.id]));

  const records = buildDemoRecords().map((record) => {
    const region = REGIONS.find((r) => r.name === record.region);
    const regionId = region && regions.get(`${region.name}/${region.uf}`);
    const diseaseId = diseases.get(record.disease);
    if (!regionId || !diseaseId) throw new Error(`Unknown demo region or disease: ${record.region}, ${record.disease}`);
    return {
      diseaseId,
      regionId,
      recordDate: record.recordDate,
      epiWeek: record.epiWeek,
      caseCount: record.caseCount,
      alertLevel: record.alertLevel,
      source: record.source,
    };
  });

  await prisma.epidemiologicalRecord.createMany({ data: records });
  console.log(
    `Seed: ${removed.count} old demo records removed, ${records.length} created for the last ${DEMO_WEEKS} weeks (source marked ${DEMO_SOURCE_PREFIX}).`
  );
}

async function main() {
  await seedAdmin();
  await seedReferenceData();
  await seedDemoRecords();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
