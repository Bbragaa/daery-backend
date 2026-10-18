-- =============================================================================
-- 1. Registro do consentimento (LGPD, art. 8º, §2º)
-- O cadastro público já exige acceptTerms = true, mas o aceite não era gravado.
-- Sem data e versão, o Daery não consegue provar que o consentimento foi obtido.
-- Contas anteriores a esta migração e contas criadas por ADMIN ficam com NULL:
-- não há como afirmar que aceitaram algum termo.
-- =============================================================================
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersion" TEXT;

-- Data e versão andam juntas: ou as duas existem, ou nenhuma.
ALTER TABLE "User" ADD CONSTRAINT "User_terms_consistent"
  CHECK (("termsAcceptedAt" IS NULL) = ("termsVersion" IS NULL));

-- =============================================================================
-- 2. Usuários legados com perfil profissional sem verificação
-- No schema antigo o perfil padrão era HEALTH_PROFESSIONAL. Depois das migrações
-- de 09/10/2026 essas contas continuavam HEALTH_PROFESSIONAL com
-- verificationStatus = NOT_REQUIRED e sem registro profissional, ou seja,
-- podiam notificar casos sem nunca terem sido aprovadas.
--
-- Elas passam a CITIZEN com o pedido de HEALTH_PROFESSIONAL pendente. Um ADMIN
-- decide em PATCH /api/users/:id/verification, como em qualquer cadastro novo.
-- Contas com ProfessionalRegistration (cadastro pelo fluxo novo) não são tocadas.
-- =============================================================================
UPDATE "User"
SET "role" = 'CITIZEN',
    "requestedRole" = 'HEALTH_PROFESSIONAL',
    "verificationStatus" = 'PENDING',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "role" = 'HEALTH_PROFESSIONAL'
  AND "verificationStatus" = 'NOT_REQUIRED'
  AND NOT EXISTS (
    SELECT 1 FROM "ProfessionalRegistration" pr WHERE pr."userId" = "User"."id"
  );

-- =============================================================================
-- 3. Faixa etária em texto livre (registros anteriores à validação por faixas)
-- A API aceita apenas as faixas abaixo; valores antigos como "35 anos" ficavam
-- fora de qualquer agregação.
--   - Já é uma faixa válida (ignorando espaços)  -> mantém, normalizada.
--   - É só uma idade, com ou sem "ano(s)"          -> converte para a faixa.
--   - Qualquer outro texto                        -> IGNORADA.
-- A idade exata não é preservada de propósito: guardar faixa em vez de idade é a
-- minimização de dados adotada pelo projeto (RNE002/LGPD). Faça backup do banco
-- antes de aplicar esta migração se precisar consultar os valores originais.
-- =============================================================================
UPDATE "CaseNotification" AS cn
SET "patientAgeRange" = CASE
      WHEN normalized.value IN ('0-4','5-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80+','IGNORADA')
        THEN normalized.value
      WHEN normalized.age IS NULL OR normalized.age > 130 THEN 'IGNORADA'
      WHEN normalized.age <= 4  THEN '0-4'
      WHEN normalized.age <= 9  THEN '5-9'
      WHEN normalized.age <= 19 THEN '10-19'
      WHEN normalized.age <= 29 THEN '20-29'
      WHEN normalized.age <= 39 THEN '30-39'
      WHEN normalized.age <= 49 THEN '40-49'
      WHEN normalized.age <= 59 THEN '50-59'
      WHEN normalized.age <= 69 THEN '60-69'
      WHEN normalized.age <= 79 THEN '70-79'
      ELSE '80+'
    END,
    "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT
    "id",
    upper(regexp_replace("patientAgeRange", '\s+', '', 'g')) AS value,
    CASE
      WHEN "patientAgeRange" ~* '^\s*\d{1,3}\s*(anos?)?\s*$'
        THEN substring("patientAgeRange" FROM '\d{1,3}')::INTEGER
    END AS age
  FROM "CaseNotification"
) AS normalized
WHERE cn."id" = normalized."id"
  AND cn."patientAgeRange" NOT IN ('0-4','5-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80+','IGNORADA');
