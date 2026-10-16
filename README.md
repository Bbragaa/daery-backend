<div align="center">

<img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow?style=for-the-badge" />
<img src="https://img.shields.io/badge/node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/typescript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" />

<br/>
<br/>

# Daery — Backend

**Backend service for Daery — a platform for tracking and visualizing disease outbreak data across regions.**

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [API Docs](#-api-docs) · [Contributing](#-contributing)

</div>

---

## About

Daery is an epidemiological surveillance platform that centralizes medical records and diagnostic data to support public health decision-making. This repository contains the REST API that powers the platform, responsible for authentication, business logic, and data management.

The system is designed for health professionals, public managers, researchers, and the general public who need reliable, structured information about disease incidence across geographic regions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20.x |
| Language | TypeScript 5.x |
| Framework | Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Authentication | JWT + bcryptjs |
| Validation | Zod |
| Testing | Jest + ts-jest |
| API Docs | Swagger (OpenAPI) |

Redis was listed in the original architecture as a cache/session store. It is **not part of this
phase**: sessions use stateless JWTs (the user is re-read from PostgreSQL on every request) and no
endpoint needs a cache yet. It may come back if the epidemiological summary needs caching at
national scale (see [ADR 0004](docs/adr/0004-single-prisma-schema-and-infodengue-data.md)).

---

## Architecture

The backend follows the **MVCS pattern** (Model, View, Controller, Service), keeping business logic isolated and the codebase easy to maintain and test.

```
src/
├── controllers/     # Receives HTTP requests, delegates to services
├── services/        # Business logic
├── routes/          # API endpoints + OpenAPI annotations
├── validations/     # Zod schemas for request bodies
├── middlewares/     # Authentication, authorization, validation, rate limit, errors
├── config/          # Environment validation, Prisma client, Swagger
├── utils/           # AppError, JWT, document (CPF/CNPJ) helpers
├── types/           # Express request augmentation (req.user)
├── database/        # Seed script
└── tests/           # Unit (services, utils) and HTTP (supertest) tests
```

The data model lives in `prisma/schema.prisma` and its versioned migrations in `prisma/migrations/`.

```
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or `docker compose up -d`)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Bbragaa/daery-backend.git
cd daery-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your local credentials
```

### Database setup

```bash
# Run migrations
npx prisma migrate dev

# Create the first ADMIN, the disease catalog and the municipalities
# (set SEED_DEMO_DATA=true to also load the fictitious records)
npx prisma db seed

# Pull real data from InfoDengue (dengue, chikungunya, Zika)
npm run sync:infodengue
```

#### Upgrading a database that already has data

On an existing database use `npx prisma migrate deploy` (never `migrate dev`), and back it up first.
Migration `20261015120000_consent_and_legacy_cleanup` changes existing rows
(see [ADR 0006](docs/adr/0006-consent-record-and-legacy-data-cleanup.md)):

- `HEALTH_PROFESSIONAL` accounts with no professional registration become `CITIZEN`
  with a `PENDING` request. After the deploy, an ADMIN reviews them with
  `GET /api/users?verificationStatus=PENDING` and `PATCH /api/users/:id/verification`.
- Free-text `patientAgeRange` values become the matching age range or `IGNORADA`.

### Running

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables. The main ones are:

```env
DATABASE_URL=        # PostgreSQL connection string
JWT_SECRET=          # Secret key for signing tokens
JWT_EXPIRES_IN=      # Token expiration (e.g. 7d)
PORT=                # Server port (default: 3000)
CORS_ORIGIN=         # Allowed frontend origin
TERMS_VERSION=       # Version of the sign-up consent text; change it when the text changes
TRUST_PROXY=         # Reverse proxies in front of the API (0 = direct, 1 = behind Nginx, etc.)
```

In production the API refuses to start if `JWT_SECRET` still contains the example value
(`change-me…`). Generate one with
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

---

## Authentication and roles

| Role | How it is obtained | Can |
|---|---|---|
| `CITIZEN` | Public sign-up (`accountType: CITIZEN`) | Use the citizen experience |
| `HEALTH_PROFESSIONAL` | Sign-up with council data, then ADMIN approval | Read and report case notifications |
| `INSTITUTION` | Sign-up with CNPJ, then ADMIN approval | Read and report case notifications |
| `RESEARCHER` | Assigned by an ADMIN | Read case notifications |
| `ADMIN` | Seed or another ADMIN | Manage users, approve sign-ups, delete case notifications |

1. `POST /api/auth/register` or `POST /api/auth/login` returns `{ token, user }`.
2. Send `Authorization: Bearer <token>` on every other request.
3. `GET /api/auth/me` returns the current user (useful to restore a session).
4. `PATCH /api/auth/me` lets the user change their own name (the only self-editable field for now).

Admin safeguards: an ADMIN cannot deactivate their own account nor change their own role
(both answer `409`), so there is always another ADMIN able to fix mistakes. When an ADMIN sets
a role directly, the verification fields follow it: `HEALTH_PROFESSIONAL` and `INSTITUTION`
become `APPROVED`; other roles get `NOT_REQUIRED` and no `requestedRole`.

Errors always have the shape `{ "error": string, "details"?: object }`; validation
errors put per-field messages in `details.fieldErrors`. See ADR 0003 for the rationale.

## Epidemiological data

Real data comes from [InfoDengue](https://info.dengue.mat.br/services/api/doc) and is stored in
`EpidemiologicalRecord` (see ADR 0004). To refresh it:

- `npm run sync:infodengue` (optionally `-- 26` for the last 26 weeks), or
- `POST /api/sync/infodengue` as ADMIN: answers `202` and runs in the background; follow it with
  `GET /api/sync/infodengue/status`. A second request while one is running gets `409`, or
- set `INFODENGUE_SYNC_INTERVAL_HOURS` (e.g. `24`) to sync automatically (skipped while another
  run is in progress).

The lock lives in memory, so it covers one API instance. The CLI script runs in its own process;
running it at the same time as the API sync only wastes calls (writes are idempotent).

**Demo data.** `SEED_DEMO_DATA=true` loads fictitious weekly series for the last 8 complete
epidemiological weeks before the day the seed runs, with InfoDengue-style alert levels, so the map
and the alerts have content even without the sync. Every row has its source prefixed with
`[FICTÍCIO]`, responses flag it (`includesDemoData`, `isDemo`), and real InfoDengue data always
takes precedence in the alerts. Re-running the seed replaces the old demo rows.

Public endpoints used by the map, filters and alerts (no login required, aggregates only):

| Endpoint | Purpose |
|---|---|
| `GET /api/diseases` | Disease catalog for filters |
| `GET /api/regions?uf=GO` | Municipalities with coordinates |
| `GET /api/epidemiological-data/summary?diseaseId&uf&regionId&startDate&endDate` | Cases per municipality × disease with severity (ADR 0005) |
| `GET /api/alerts?uf&regionId&diseaseId&minLevel&weeks` | Current preventive alerts with recommendations |

`platformReports` in the summary (cases reported inside Daery) is shown in full to professional
profiles (`HEALTH_PROFESSIONAL`, `INSTITUTION`, `RESEARCHER`, `ADMIN`, identified by an optional
token). Anonymous visitors and citizens get counts from 1 to 4 as `null`, with `suppressed: true`,
because in a small municipality "1 death this week" can identify a person.

## Smoke test (end-to-end check of a running API)

With the API running (`npm run dev`) on a migrated and seeded database:

```bash
npm run smoke
```

It exercises 22 checks (public data, sign-up and consent record, login, permissions, admin approval,
case report, small-count suppression, admin safeguards, soft delete) and prints PASS / FAIL / PULADO for each. It creates test accounts
`*@smoke.daery.local` and a suspected case, then deactivates/deletes them. Do not run it in production.

## API Docs

Once the server is running, interactive API documentation is available at:

```
http://localhost:3000/api/docs
```

The Swagger spec follows the OpenAPI 3.0 standard. 
---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

In short:
- Branch off from `main` and open a PR — direct commits to `main` are not allowed
- Follow the [Conventional Commits](https://www.conventionalcommits.org/) standard (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`)
- Write or update tests for any changed logic

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Developed as a capstone project (TCC) — Computer Science</sub>
</div>
