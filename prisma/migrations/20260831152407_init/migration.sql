-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HEALTH_PROFESSIONAL', 'RESEARCHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('SUSPECTED', 'CONFIRMED', 'DISCARDED', 'DEATH');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('M', 'F', 'OTHER', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'HEALTH_PROFESSIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "ibgeCode" TEXT,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disease" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icdCode" TEXT,
    "description" TEXT,

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseNotification" (
    "id" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "patientAgeRange" TEXT NOT NULL,
    "patientSex" "Sex" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'SUSPECTED',
    "notificationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symptomsOnsetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Region_ibgeCode_key" ON "Region"("ibgeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Disease_icdCode_key" ON "Disease"("icdCode");

-- AddForeignKey
ALTER TABLE "CaseNotification" ADD CONSTRAINT "CaseNotification_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNotification" ADD CONSTRAINT "CaseNotification_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNotification" ADD CONSTRAINT "CaseNotification_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
