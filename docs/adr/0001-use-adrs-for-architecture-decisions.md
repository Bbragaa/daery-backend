# 0001. Use ADRs for architecture decisions

Status: Accepted

## Context

Architecture decisions (framework/library choices, structural conventions, non-obvious
trade-offs) were being made without a record of why. As the project grows past the initial
scaffold, later contributors (including future work on this codebase) need to know why a
decision was made, not just what the code currently does.

## Decision

Record architecture decisions as ADRs under `docs/adr/`, using `docs/adr/template.md`. Files are
numbered sequentially (`NNNN-kebab-case-title.md`). This applies to decisions that shape future
work — a library choice, a structural convention, a trade-off with real alternatives — not
routine implementation details.

## Consequences

Decisions and their reasoning are discoverable in the repo itself instead of living only in chat
history or commit messages. Adds a small amount of overhead per non-trivial decision.
