# 0004. Single Prisma schema (absorbing the team SQL package) and InfoDengue as data source

Status: Accepted

## Context

1. The team produced a standalone SQL package (`Daery_Banco_de_Dados`) with tables
   `usuario`, `doenca`, `localizacao`, `registro_epidemiologico` and `notificacao`
   (Portuguese names, integer identity keys). The API, however, reads only the
   tables created by the Prisma migrations (`User`, `Disease`, `Region`,
   `CaseNotification`, UUID keys). Running both would create two parallel,
   unsynchronized databases.
2. Decision D5 (2026-10-09): epidemiological data comes from an external API.
   InfoDengue (Fiocruz/FGV) publishes weekly dengue, chikungunya and Zika data
   per municipality (IBGE code), including an alert level from 1 to 4.

## Decision

- **Prisma migrations are the single source of truth for the schema.** The SQL
  package is kept as conceptual documentation; its design is absorbed:

  | SQL package | Prisma | Notes |
  |---|---|---|
  | `usuario` (`tipo_usuario`: comum, profissional_saude) | `User` (`role`) | Roles cover more profiles (ADR 0003) |
  | `doenca` (`nome_doenca` unique, `categoria`, `nivel_risco`) | `Disease` (`name` unique, `category`, `riskLevel`) | + `icdCode`, `infoDengueKey` |
  | `localizacao` (`cidade`, `estado`, lat/long, CHECKs, unique) | `Region` (`name`, `uf`, `latitude`/`longitude` DECIMAL(9,6), same CHECKs, unique `name`+`uf`) | + `ibgeCode` (required by InfoDengue) |
  | `registro_epidemiologico` (date, disease, location, cases ≥ 0, source, 3 indexes) | `EpidemiologicalRecord` (same fields, same CHECK and indexes) | + `epiWeek`, `estimatedCases`, `incidencePer100k`, `alertLevel` |
  | `notificacao` (per-user message, read flag) | not yet | Planned with the alerts module (stage B3) |
  | `03_dados_teste.sql` | `src/database/seed-data.ts` | Fictitious records only with `SEED_DEMO_DATA=true`, source prefixed `[FICTÍCIO]` |

- **InfoDengue sync.** `syncInfoDengue` fetches the last `INFODENGUE_SYNC_WEEKS`
  epidemiological weeks for every (municipality with IBGE code × disease with
  `infoDengueKey`) pair and upserts them, keyed by disease + region + week start +
  source. It runs on demand (`POST /api/sync/infodengue`, ADMIN), from the CLI
  (`npm run sync:infodengue`) or periodically (`INFODENGUE_SYNC_INTERVAL_HOURS`).
  The frontend never calls InfoDengue directly; the database copy also plays the
  cache role originally planned for Redis.
- **Epidemiological week** follows the SINAN rule (Sunday–Saturday weeks; week 1
  contains January 4) and is tested against the examples in the InfoDengue docs.

## Consequences

- One schema to migrate, seed and document (section 18 of the spec).
- Real and fictitious data never mix silently: demo rows are opt-in and labelled.
- The map depends on InfoDengue availability only at sync time, not per request.
- InfoDengue covers only dengue, chikungunya and Zika; COVID-19 and influenza
  show data only from other sources (demo seed or future integrations).
- Adding a municipality is a seed/`Region` row with its IBGE code; no code change.
