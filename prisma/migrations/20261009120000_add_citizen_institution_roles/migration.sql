-- AlterEnum
-- Separado da migration seguinte: o PostgreSQL não permite usar um valor de
-- enum recém-criado (ex.: como DEFAULT) na mesma transação em que ele foi adicionado.
ALTER TYPE "Role" ADD VALUE 'INSTITUTION';
ALTER TYPE "Role" ADD VALUE 'CITIZEN';
