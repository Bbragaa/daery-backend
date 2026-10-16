# 0005. Map summary, severity and preventive alerts

Status: Accepted

## Context

The map (RF-002), its filters (RF-003) and the preventive alerts shown to everyone
(minimal RF-004, decision D2) need aggregated data per municipality. Decision D5
delegated severity to the external data source instead of thresholds invented by
the team. InfoDengue publishes an alert level per municipality and epidemiological
week, documented by municipal health bulletins as:

| Level | Colour | Meaning |
|---|---|---|
| 1 | green | climate conditions unfavourable to transmission |
| 2 | yellow | conditions favourable to the vector and to transmission |
| 3 | orange | increased and sustained transmission |
| 4 | red | incidence above 90% of the historical series |

## Decision

New business rules (to be added to section 13 of the specification):

- **RNE012 — Severity.** The severity of a municipality × disease in a period is the
  InfoDengue alert level of its most recent week in that period: 1 LOW, 2 MEDIUM,
  3 HIGH, 4 CRITICAL. Without an alert level (data from other sources) severity is
  `null`; Daery does not compute its own.
- **RNE013 — Preventive alert.** An alert is issued for a municipality × disease when
  the most recent InfoDengue week within the last `weeks` (default 4) has level ≥ 3.
  A high level in an older week does not trigger an alert if the latest week dropped.
- **RNE014 — No double counting.** External counts (`EpidemiologicalRecord`) and
  case notifications reported inside Daery are returned separately (`totalCases`
  and `platformReports`), because the same patient may appear in both.
- **RNE002 (now implemented for the public endpoints).** Public endpoints return
  only aggregates per municipality, never patient-level data.

Endpoints:

- `GET /api/epidemiological-data/summary` (public): filters `diseaseId`, `regionId`,
  `uf`, `startDate`, `endDate` (default last 8 weeks, at most 366 days). Sorted by
  severity, then cases. Aggregation is done in the service over the records of the
  period, which is bounded by the 366-day limit.
- `GET /api/alerts` (public): filters `diseaseId`, `regionId`, `uf`, `minLevel`
  (default 3), `weeks` (default 4); each alert carries general Aedes prevention
  recommendations and its source.
- `GET /api/case-notifications` now returns `{ data, page, pageSize, total }` with
  filters by disease, place, status and period.

## Consequences

- The frontend maps `severity` to colours and treats `null` as "no classification".
- Severity and alerts only exist for dengue, chikungunya and Zika (InfoDengue scope).
- Per-user stored notifications (team SQL package, table `notificacao`) stay for later:
  they need the user's home municipality, which belongs to the profile (stage B4).
- If the number of municipalities grows a lot (RNF-003), the in-service aggregation
  can move to a SQL `GROUP BY` without changing the response contract.

## Update (2026-10-15)

- Alerts also consider rows from the demo seed (source prefixed `[FICTÍCIO]`), flagged with
  `isDemo: true`. For the same municipality × disease, InfoDengue data always wins.
- `platformReports` is suppressed for the public: counts from 1 to 4 become `null`
  (`suppressed: true`). Professional profiles, identified by an optional bearer token, see the
  full counts. The response carries `Vary: Authorization` and `Cache-Control: private, no-store`.
- Known limit: suppression is per response. Someone comparing two overlapping periods can still
  infer a small difference. Closing that would need fixed reporting windows (e.g. whole
  epidemiological weeks only), which the team can adopt if the data grows.
