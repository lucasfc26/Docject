-- Recua o início do serviço de setembro/2026 para 05/10/2026 (meia-noite em America/Fortaleza).
-- O banco de horas é calculado a partir de startDate: setembro some e as 6h carregadas para outubro também.
-- Este script também remove cobrança, relatório e apontamentos do período 2026-09.
--
-- 1) Rode o SELECT de conferência.
-- 2) Se estiver certo, rode o bloco BEGIN ... COMMIT.
-- 3) Se houver mais de um serviço, restrinja o WHERE (nome do cliente/serviço).
--
-- No VPS:
-- docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
--   psql -U projectfy -d projectfy < backend/prisma/scripts/shift-service-start-to-october-2026.sql

-- Conferência
SELECT
  s.id,
  c.name AS cliente,
  s.name AS servico,
  s."startDate",
  s."monthlyHours",
  s."hoursExpirePercent",
  s."hoursExpirationMonths",
  s."monthlyValue",
  s."paymentDay"
FROM "Service" s
JOIN "Client" c ON c.id = s."clientId"
WHERE s."startDate" >= TIMESTAMP '2026-09-01'
  AND s."startDate" < TIMESTAMP '2026-10-01'
ORDER BY c.name, s.name;

BEGIN;

CREATE TEMP TABLE target_services ON COMMIT DROP AS
SELECT s.id
FROM "Service" s
JOIN "Client" c ON c.id = s."clientId"
WHERE s."startDate" >= TIMESTAMP '2026-09-01'
  AND s."startDate" < TIMESTAMP '2026-10-01';
  -- AND c.name ILIKE '%Sal Energia%'
  -- AND s.name ILIKE '%...%'

UPDATE "Service"
SET
  "startDate" = TIMESTAMP '2026-10-05 03:00:00',
  "updatedAt" = NOW()
WHERE id IN (SELECT id FROM target_services);

DELETE FROM "FinancialTransaction"
WHERE "serviceId" IN (SELECT id FROM target_services)
  AND "servicePeriod" = '2026-09';

DELETE FROM "ServiceMonthlyReport"
WHERE "serviceId" IN (SELECT id FROM target_services)
  AND month = '2026-09';

DELETE FROM "ServiceWorkLog"
WHERE "serviceId" IN (SELECT id FROM target_services)
  AND month = '2026-09';

SELECT
  s.id,
  c.name AS cliente,
  s.name AS servico,
  s."startDate",
  (
    SELECT COUNT(*) FROM "FinancialTransaction" ft
    WHERE ft."serviceId" = s.id AND ft."servicePeriod" = '2026-09'
  ) AS cobrancas_setembro,
  (
    SELECT COUNT(*) FROM "ServiceMonthlyReport" r
    WHERE r."serviceId" = s.id AND r.month = '2026-09'
  ) AS relatorios_setembro,
  (
    SELECT COUNT(*) FROM "ServiceWorkLog" w
    WHERE w."serviceId" = s.id AND w.month = '2026-09'
  ) AS apontamentos_setembro
FROM "Service" s
JOIN "Client" c ON c.id = s."clientId"
WHERE s.id IN (SELECT id FROM target_services);

COMMIT;
