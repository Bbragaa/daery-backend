# 0006. Consent record and legacy data cleanup

Status: Accepted

## Context

The 2026-10-15 review of the backend found three problems that show up only on a
database that already holds Phase 01 data, plus one gap that affects every
account:

- **Unverified professionals.** Phase 01 created every user as
  `HEALTH_PROFESSIONAL`. After the 2026-10-09 migrations those accounts kept that
  role with `verificationStatus = NOT_REQUIRED` and no professional
  registration, so they could report cases without ever being approved
  (bypassing ADR 0003).
- **Free-text age.** `patientAgeRange` accepted any text before the age-range
  validation existed (e.g. `"35 anos"`). Those rows cannot be aggregated.
- **Seed conflict.** The seed upserted municipalities by `ibgeCode`. A
  municipality created in Phase 01 without that code made the seed try to insert
  a duplicate and fail on `Region_name_uf_key`.
- **Consent not recorded.** Sign-up requires `acceptTerms = true`, but nothing
  was stored. Under the LGPD (art. 8, §2) the controller must be able to prove
  consent was obtained.

## Decision

Migration `20261015120000_consent_and_legacy_cleanup`:

1. Adds `User.termsAcceptedAt` and `User.termsVersion`, with a CHECK that both
   are set or both are null. `POST /api/auth/register` fills them with the
   current time and `TERMS_VERSION` (env, default `2026-10-15`). Accounts created
   before this migration or by an ADMIN through `POST /api/users` stay null: we
   cannot claim they accepted any text.
2. Moves `HEALTH_PROFESSIONAL` accounts with `NOT_REQUIRED` and no
   `ProfessionalRegistration` to `CITIZEN` with a `PENDING` request for
   `HEALTH_PROFESSIONAL`. An ADMIN reviews them like any new sign-up.
3. Normalizes `patientAgeRange`: valid ranges are kept (ignoring spaces and
   case), a bare age (`"35"`, `"35 anos"`) becomes its range, anything else
   becomes `IGNORADA`.

The seed now upserts municipalities by `name + uf`, so an existing row is reused
and receives its IBGE code and coordinates.

## Consequences

- Legacy professionals lose the ability to report cases until an ADMIN approves
  them. ADMINs should list `GET /api/users?verificationStatus=PENDING` after the
  deploy. These accounts have no council registration on file, so the ADMIN
  must confirm it outside the system before approving.
- A `HEALTH_PROFESSIONAL` created by an ADMIN through `POST /api/users` before
  this migration is also moved to `PENDING`; approving it restores the role.
- The exact age of legacy notifications is discarded on purpose (data
  minimization). Back up the database before applying the migration if the
  original values are needed.
- `TERMS_VERSION` must change whenever the consent text in the frontend
  (`Register.tsx`) changes; otherwise new accounts are recorded against the
  wrong text.
