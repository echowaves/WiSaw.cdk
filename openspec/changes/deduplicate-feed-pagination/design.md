## Context

Five photo feed controllers (`feedForWave`, `feedForWatcher`, `feedForUngrouped`, `feedRecent`, `feedForFriend`) and one text search controller (`feedForTextSearch`) each contain ~60–72 lines of nearly identical boilerplate:

```
import psql, plainToClass, Photo
assertValidUuid()
const limit = N
const offset = pageNumber * limit
await psql.connect()
buildSearchClause()
SQL query with LIMIT/OFFSET
psql.query(query, params).rows
await psql.clean()
results.map(p => plainToClass(Photo, p))
noMoreData = photos.length < limit
return { photos, batch, noMoreData, nextPage }
```

The only variation between controllers is the SQL query string (different JOINs, WHERE clauses, and sort configurations). The `row_number() OVER (...)` computation in four of the five controllers is dead code — the Photo model has no `row_number` property and the GraphQL schema field is never populated. `feedForTextSearch` additionally hardcodes `noMoreData: true` and `nextPage: null`, making it a single-page feed while all others support multi-batch pagination.

## Goals / Non-Goals

**Goals:**
- Create a shared `paginatedPhotos.ts` utility that handles `psql.connect/clean`, query execution, `plainToClass` mapping, and `noMoreData`/`nextPage` computation
- Refactor 5 offset-based photo feeds to use the utility (keeping each controller's SQL query, sort config, and search clause)
- Refactor `feedForTextSearch` to use the utility and fix its hardcoded `noMoreData`/`nextPage`
- Remove dead `row_number() OVER (...)` SQL from all 5 feeds
- Update the `photo-feed` spec to reflect the corrected `feedForTextSearch` behavior

**Non-Goals:**
- `feedByDate` is out of scope (different pagination model — days-cursor with Promise.all loops)
- `listWaves` is out of scope (returns Wave[], not Photo[] — would need a separate utility)
- Adding `limit` as a GraphQL parameter (currently none of the feeds accept it from the client)
- Changing page sizes (feedRecent stays at 20, all others stay at 100)

## Decisions

### Decision 1: Photo-specific utility (not generic)

**Choice**: `fetchPaginatedPhotos(options)` that always maps to `Photo[]`, not a generic `<T>` utility.

```typescript
interface PaginatedPhotoOptions {
  query: string
  params: unknown[]
  pageNumber: number
  batchSize?: number       // default 100
  noMoreDataOverride?: true // for feedForTextSearch migration
}

interface PaginatedPhotoResult {
  photos: Photo[]
  noMoreData: boolean
  nextPage: number | null
}
```

**Rationale**: `listWaves` uses a different model (Wave), and creating a generic `<T>` utility introduces a `modelClass` parameter that adds complexity for no immediate benefit. The Photo feeds are the only ones with this duplication pattern right now. If Wave pagination needs deduplication later, a separate generic utility can be created.

**Alternatives considered**:
- Generic `fetchPaginated<T>()` with `modelClass` parameter: More future-proof but adds a new abstraction surface now. Rejected — YAGNI for Wave feeds.
- Inline SQL builder/DSL: Too invasive, changes how controllers write queries entirely. Rejected — higher migration cost.

### Decision 2: Use `finally` block for `psql.clean()`

**Choice**: The utility uses `finally { await psql.clean() }` instead of try/catch with duplicate `psql.clean()` calls in both branches.

```typescript
await psql.connect()
try {
  // query + mapping
  return { photos, noMoreData, nextPage }
} finally {
  await psql.clean()
}
```

**Rationale**: `finally` always runs regardless of whether the query succeeds or throws. Current code uses try/catch in `feedForTextSearch` (clean in both branches) but bare connect/clean in the others — inconsistency that `finally` fixes.

**Alternatives considered**:
- Keep try/catch: Redundant with `finally`, already inconsistent across controllers.

### Decision 3: Remove `row_number()` — dead code

**Choice**: Remove `row_number() OVER (...) + offset as row_number` from all 5 SQL queries.

**Rationale**: The Photo model class has no `row_number` property. `plainToClass(Photo, photo)` cannot map a column that doesn't exist on the target class. The GraphQL schema declares `row_number: Int!` but the field is never populated — the Photo type's `toJSON()` method doesn't include it. This SQL computation runs on every query for zero observable effect.

**Risk**: If the GraphQL resolver somehow expects this field (AppSync auto-mapping), queries would fail validation. But since the field has always been `null` (or missing), removing it won't change the runtime value.

### Decision 4: Preserve `feedForTextSearch` single-page behavior

**Choice**: Refactor `feedForTextSearch` to use the utility but pass `noMoreDataOverride: true`, which forces `noMoreData: true` / `nextPage: null` — identical to current behavior.

**Rationale**: The utility's `noMoreDataOverride` flag lets us get deduplication benefits (connection management, error handling, result mapping) without changing `feedForTextSearch`'s client-visible behavior. The hardcoded values are removed from the controller but their effect is preserved by the flag. This is a zero-breaking-change refactor.

**Future**: A separate change can address the archived `2026-03-30-add-nextpage-to-photo-feed` intent to enable multi-batch pagination for `feedForTextSearch` — but that warrants its own change with proper client impact analysis.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `row_number()` removal breaks GraphQL validation if AppSync expects the field | Low risk — field has always been unpopulated; AppSync resolvers skip null/missing fields |
| `feedForTextSearch` behavior change surprises clients | Not a breaking change — `noMoreDataOverride: true` preserves existing single-page behavior |
| Utility becomes a new single point of failure | The utility is simpler than 6 copies of the same code; any bug affects all feeds but is easier to fix (one location) |
