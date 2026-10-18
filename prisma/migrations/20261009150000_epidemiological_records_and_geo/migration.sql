-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "Region" ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6);

-- AlterTable
ALTER TABLE "Disease" ADD COLUMN     "category" TEXT,
ADD COLUMN     "riskLevel" "RiskLevel",
ADD COLUMN     "infoDengueKey" TEXT;

-- CreateTable
CREATE TABLE "EpidemiologicalRecord" (
    "id" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "recordDate" DATE NOT NULL,
    "epiWeek" INTEGER,
    "caseCount" INTEGER NOT NULL,
    "estimatedCases" DOUBLE PRECISION,
    "incidencePer100k" DOUBLE PRECISION,
    "alertLevel" INTEGER,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpidemiologicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_uf_key" ON "Region"("name", "uf");

-- CreateIndex
CREATE UNIQUE INDEX "Disease_name_key" ON "Disease"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Disease_infoDengueKey_key" ON "Disease"("infoDengueKey");

-- CreateIndex
CREATE INDEX "EpidemiologicalRecord_diseaseId_recordDate_idx" ON "EpidemiologicalRecord"("diseaseId", "recordDate");

-- CreateIndex
CREATE INDEX "EpidemiologicalRecord_regionId_recordDate_idx" ON "EpidemiologicalRecord"("regionId", "recordDate");

-- CreateIndex
CREATE INDEX "EpidemiologicalRecord_recordDate_idx" ON "EpidemiologicalRecord"("recordDate");

-- CreateIndex
CREATE UNIQUE INDEX "EpidemiologicalRecord_diseaseId_regionId_recordDate_source_key" ON "EpidemiologicalRecord"("diseaseId", "regionId", "recordDate", "source");

-- CreateIndex
CREATE INDEX "CaseNotification_diseaseId_notificationDate_idx" ON "CaseNotification"("diseaseId", "notificationDate");

-- CreateIndex
CREATE INDEX "CaseNotification_regionId_notificationDate_idx" ON "CaseNotification"("regionId", "notificationDate");

-- AddForeignKey
ALTER TABLE "EpidemiologicalRecord" ADD CONSTRAINT "EpidemiologicalRecord_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpidemiologicalRecord" ADD CONSTRAINT "EpidemiologicalRecord_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restrições de domínio que o Prisma não modela; vêm do pacote de banco da equipe
-- (CHECKs de `localizacao` e `registro_epidemiologico`).
ALTER TABLE "Region" ADD CONSTRAINT "Region_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "Region" ADD CONSTRAINT "Region_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180);
ALTER TABLE "EpidemiologicalRecord" ADD CONSTRAINT "EpidemiologicalRecord_caseCount_nonnegative" CHECK ("caseCount" >= 0);
ALTER TABLE "EpidemiologicalRecord" ADD CONSTRAINT "EpidemiologicalRecord_alertLevel_range" CHECK ("alertLevel" BETWEEN 1 AND 4);
