## Context

The `listWaves` query currently supports pagination (`pageNumber`, `batch`) and sorting (`sortBy`, `sortDirection`) but has no filtering capability. The controller builds a SQL query joining `Waves` with `WaveUsers` to scope results to the requesting user. The `name` column is `STRING(255)` with a btree index. The `description` column is `TEXT` without an index.

## Goals / Non-Goals

**Goals:**
- Add optional `searchTerm` parameter to `listWaves` that filters on `name` and `description` using `ILIKE`.
- Add `name` to the allowed sort fields whitelist.
- Use parameterized queries for the search term to prevent SQL injection.

**Non-Goals:**
- Full-text search (`tsvector`/`plainto_tsquery`) — overkill for short wave names.
- Adding a GIN/trigram index — the user's wave count is small enough that `ILIKE` on a filtered join is fast.
- Searching across all waves (global search) — stays scoped to user's waves.

## Decisions

**Decision 1: Use `ILIKE` with `%term%` for substring matching.**
Simple, predictable for users. Wave names and descriptions are short strings, and the result set is already filtered to one user's waves (typically dozens, not millions). Full-text search would add complexity without meaningful benefit here.

**Decision 2: Search both `name` and `description` with OR.**
When `searchTerm` is provided, the WHERE clause adds `AND ("Waves"."name" ILIKE $2 OR "Waves"."description" ILIKE $2)` with the value `%searchTerm%`. This uses a single parameterized placeholder.

**Decision 3: Conditionally append the ILIKE clause.**
When `searchTerm` is omitted or empty, the query runs exactly as today — no performance impact on existing usage. The parameter index shifts ($1 for uuid, $2 for search term when present).

## Risks / Trade-offs

- **[Risk] `%prefix` ILIKE can't use btree index on `name`** → Accepted: result set is small (user's waves only, post-JOIN), sequential scan on filtered rows is fast enough.
- **[Risk] `description` has no index** → Accepted: same reasoning — small post-JOIN result set.
