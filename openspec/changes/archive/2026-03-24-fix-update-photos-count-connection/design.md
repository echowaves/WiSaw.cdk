## Context

The `_updatePhotosCount` helper is a shared utility called from 4 controllers and 1 Lambda. It currently manages its own `psql.connect()` / `psql.clean()` lifecycle. The `psql` module is a singleton `ManagedServerlessClient` wrapping `serverless-postgres` — a single underlying `pg.Client`, not a pool. Calling `psql.clean()` releases the connection, leaving subsequent queries on a degraded client.

## Goals / Non-Goals

**Goals:**
- Make `_updatePhotosCount` a pure query helper (no connect/clean) so it composes safely within callers' connection lifecycles.
- Fix the `mergeWaves` null return bug.
- Eliminate the `pg` deprecation warning about overlapping queries.

**Non-Goals:**
- Refactoring `psql` to use a connection pool.
- Changing the connection lifecycle pattern across all controllers — only fixing `_updatePhotosCount`.

## Decisions

**Decision 1: Remove connect/clean from `_updatePhotosCount`.**
All callers already manage their own `psql.connect()` / `psql.clean()` lifecycle. The helper just needs to run its UPDATE query and return — the caller ensures the connection is alive. This is the minimal, lowest-risk change.

**Decision 2: No changes needed in callers.**
Since all callers already call `psql.connect()` before and `psql.clean()` after their full operation block (including the `_updatePhotosCount` call), removing the internal connect/clean is sufficient. The `psql.connect()` call in `_updatePhotosCount` was a no-op (already connected), and the `psql.clean()` was the destructive operation.

## Risks / Trade-offs

- **[Risk] Future standalone callers might forget to connect** → Mitigated: all existing callers follow the connect/clean pattern, and the function name signals it's an internal helper (prefixed with `_`).
