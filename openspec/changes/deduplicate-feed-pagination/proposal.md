## Why

Five photo feed controllers (`feedForWave`, `feedForWatcher`, `feedForUngrouped`, `feedRecent`, `feedForFriend`) each contain ~70 lines of nearly identical boilerplate: `psql.connect()`, query execution, `plainToClass` mapping, `psql.clean()`, and `noMoreData` computation. This violates DRY, hides bugs (inline LIMIT/OFFSET instead of parameterized), and makes cross-cutting changes error-prone. A single shared utility eliminates this duplication.

## What Changes

- Create `lambda-fns/utilities/paginatedPhotos.ts` — a shared utility that handles `psql.connect/clean`, query execution, `plainToClass` mapping, and `noMoreData`/`nextPage` computation
- Refactor 5 feed controllers to call the utility with their SQL query and params (each controller keeps ~35–40 lines of domain logic: sort config, search clause, query string)
- Remove dead `row_number() OVER (...)` SQL from all 5 feeds (the Photo model has no `row_number` property and GraphQL's `Photo.row_number` field is never populated)
- Refactor `feedForTextSearch` to use the utility — passes `noMoreDataOverride: true` to preserve single-page behavior (zero client impact). The hardcoded `noMoreData: true` / `nextPage: null` is removed but its effect is preserved via the flag.
- `feedByDate` is explicitly **out of scope** (different pagination model — days-cursor with Promise.all loops)

## Capabilities

### Modified Capabilities

- `photo-feed`: Replace per-controller pagination boilerplate with a shared utility. `feedForTextSearch` uses the utility with `noMoreDataOverride: true` to preserve its existing single-page behavior (zero client impact). Dead `row_number` SQL removed from all feeds.

### New Capabilities

_None_

## Impact

- **Controllers**: `feedForWave.ts`, `feedForWatcher.ts`, `feedForUngrouped.ts`, `feedRecent.ts`, `feedForFriend.ts` — each simplified by ~30 lines
- **New utility**: `lambda-fns/utilities/paginatedPhotos.ts`
- **Dead code removal**: `row_number() OVER (...)` from 5 SQL queries (no functional impact)
- **No behavior change**: `feedForTextSearch` preserves its existing single-page behavior via `noMoreDataOverride: true` flag passed to the utility.
- **Specs**: `openspec/specs/photo-feed/spec.md` — update `feedForTextSearch` requirement to reflect multi-batch behavior
