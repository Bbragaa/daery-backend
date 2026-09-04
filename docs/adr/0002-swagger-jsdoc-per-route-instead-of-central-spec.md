# 0002. swagger-jsdoc with per-route annotations instead of a central spec file

Status: Accepted

## Context

The README already promised OpenAPI docs at `/api/docs`, but nothing was wired up. The
alternative to a code-first approach is hand-maintaining one big OpenAPI YAML/JSON file
describing every route, which drifts from the actual route code as soon as one side changes
without the other.

## Decision

Use `swagger-jsdoc` + `swagger-ui-express`. Each route file documents its own endpoints via an
`@openapi` JSDoc block directly above the route definition, in the same file
(`src/routes/*.routes.ts`). Shared response/request schemas (`User`, `Error`, per-entity input
types) live in `src/config/swagger.ts` as `components.schemas`, since those are genuinely reused
across routes — but path documentation is never centralized.

## Consequences

A route and its docs are edited together, so they're less likely to drift apart. Every new
route file needs its own JSDoc annotations (no central place does it for you) — this is the
expected cost and the pattern to follow for future endpoints (e.g. Case CRUD).
