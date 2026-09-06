# 0003. Require HealthInstitution on case notifications; add Region geo-coordinates

Status: Accepted

## Context

The domain model names nine entities: User, Disease, Case, Location, Health Institution,
Symptom, Notification, Epidemiological Report, Log. Four existed as Prisma models before this
change (User, Region, Disease, CaseNotification), and the TCC group scoped this iteration's MVP
work to adding only Health Institution among the remaining five — Symptom, Epidemiological
Report, and Log were considered and deferred.

Real-world compulsory case notification always originates from a reporting health facility
(hospital, clinic, lab, or basic health unit), but `CaseNotification` only tracked disease,
region, and reporting user. Separately, the platform's purpose is tracking disease advance on a
map and in graphs; `Region` had no coordinates to plot with.

## Decision

Add a `HealthInstitution` entity (`name`, `cnesCode` optional unique, `InstitutionType` enum,
`regionId` FK) with full CRUD mirroring the existing `CaseNotification` slice. Add a required,
no-default `institutionId` FK from `CaseNotification` to `HealthInstitution` — every notification
must name its origin facility, rather than allowing incomplete records via an optional FK or
free-text facility name.

Add nullable `latitude`/`longitude` `Float` columns directly on `Region` rather than a separate
geolocation entity, since they're a 1:1 attribute of a municipality (its centroid), not a
standalone concept.

## Consequences

Local dev `CaseNotification` rows could not survive the migration without a value for
`institutionId`; since no seed script exists yet, the dev database was reset rather than writing
a one-off backfill migration. Future case-submission flows now depend on a `HealthInstitution`
already existing — there is no auto-create on notify.

Symptom, Epidemiological Report, and Log stay deferred: symptom detail isn't required by any
current requirement and can be a free-text field later if needed; an epidemiological report is a
derived/aggregation view that needs real case volume to design well; audit logging is better
handled as cross-cutting middleware than a queryable CRUD entity, if it's ever needed.
