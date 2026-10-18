-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CITIZEN',
ADD COLUMN     "requestedRole" "Role",
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "cpf" TEXT;

-- AlterTable
ALTER TABLE "CaseNotification" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProfessionalRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "council" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "specialty" TEXT,

    CONSTRAINT "ProfessionalRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalRegistration_userId_key" ON "ProfessionalRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalRegistration_council_uf_registrationNumber_key" ON "ProfessionalRegistration"("council", "uf", "registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_userId_key" ON "Institution"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_cnpj_key" ON "Institution"("cnpj");

-- AddForeignKey
ALTER TABLE "ProfessionalRegistration" ADD CONSTRAINT "ProfessionalRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
