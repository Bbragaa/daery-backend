/*
  Warnings:

  - Added the required column `institutionId` to the `CaseNotification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('HOSPITAL', 'CLINIC', 'LABORATORY', 'UBS');

-- AlterTable
ALTER TABLE "CaseNotification" ADD COLUMN     "institutionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "HealthInstitution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnesCode" TEXT,
    "type" "InstitutionType" NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthInstitution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthInstitution_cnesCode_key" ON "HealthInstitution"("cnesCode");

-- AddForeignKey
ALTER TABLE "HealthInstitution" ADD CONSTRAINT "HealthInstitution_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNotification" ADD CONSTRAINT "CaseNotification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "HealthInstitution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
