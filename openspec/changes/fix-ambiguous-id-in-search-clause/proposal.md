## Why

The `buildSearchClause` utility introduced in `add-search-to-feeds` uses an unqualified `"id"` column reference in its SQL fragment. When a feed query JOINs another table (Watchers, WavePhotos), both tables have an `id` column, causing PostgreSQL to throw `column reference "id" is ambiguous`. This breaks `feedForWatcher` and `feedForWave` when a search term is provided.

## What Changes

- Qualify the `"id"` reference in `buildSearchClause` to `p."id"` so it unambiguously refers to the Photos table
- Standardize the Photos table alias to `p` in `feedRecent` and `feedByDate` (which currently use no alias) so the qualified reference works consistently across all feeds

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

_None — this is a bug fix to existing implementation, not a spec-level behavior change. The spec already requires search to refine feed results; it just doesn't work on JOINed feeds due to the ambiguous column._

## Impact

- **Utilities**: `lambda-fns/utilities/searchClause.ts` — change `"id"` to `p."id"`
- **Controllers**: `feedRecent.ts` and `feedByDate.ts` — add `p` alias to `FROM "Photos"` clause
- **No API changes**: GraphQL schema, dispatcher, and resolvers unchanged
