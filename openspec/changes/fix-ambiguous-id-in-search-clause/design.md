## Context

`buildSearchClause` returns a SQL fragment containing `AND "id" IN (...)`. This works for queries without JOINs (`feedRecent`, `feedByDate`, `feedForTextSearch`) because `"id"` unambiguously refers to the only table. But `feedForWatcher` JOINs `Watchers` and `feedForWave` JOINs `WavePhotos` — both have their own `id` column, making the reference ambiguous.

Three of the five feed controllers already alias Photos as `p`. The other two (`feedRecent`, `feedByDate`) use `FROM "Photos"` without an alias.

## Goals / Non-Goals

**Goals:**
- Fix the ambiguous column error so search works on all feeds
- Standardize the Photos table alias to `p` across all feed controllers

**Non-Goals:**
- Changing search behavior or query structure
- Adding aliases to non-feed controllers

## Decisions

### Use `p."id"` in the search clause and standardize alias

**Decision**: Change `buildSearchClause` to emit `p."id"` instead of `"id"`, and add `p` alias to the two controllers that lack it.

**Alternatives considered**:
- Add a `tableAlias` parameter to `buildSearchClause`: Over-engineered for a utility only used with Photos. All callers always search Photos.
- Use `"Photos"."id"` (full table name): Works but inconsistent with the existing `p.*`, `p.id`, `p.active` pattern used by 3 of 5 controllers.

## Risks / Trade-offs

- **Minimal risk**: Adding an alias to `FROM "Photos" p` is equivalent SQL — no behavior change. `feedByDate` already references `"Photos".*` and `"Photos"."createdAt"` which work identically with or without an alias.
