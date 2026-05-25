## Context

Auto-grouping currently uses a single `isActive` flag as a cursor to track which wave to fill. When no active wave exists, a new one is always created. This means non-contiguous photo batches from the same locality (NYC → LA → NYC) produce duplicate waves. The `isActive` flag also introduced a stale-cursor bug that required a workaround (deactivation on zero progress).

The Waves table has a B-tree index on the `location` column, which is useless for PostGIS spatial queries (`ST_DWithin` requires GiST). This is a silent performance bug affecting all spatial lookups on waves.

## Goals / Non-Goals

**Goals:**
- Eliminate duplicate waves by searching existing waves before creating new ones
- Remove the `isActive` column and all cursor-based logic
- Fix the Waves.location index (B-tree → GiST) for correct spatial query support
- Maintain name refinement accuracy when adding photos to an existing wave

**Non-Goals:**
- Routing each photo to a different wave within a single invocation (cluster-then-route model). We keep the streaming model: one wave per invocation, skip non-matching.
- Changing the `wavesCreated` cap (still at most 1 new wave per call, though an existing wave may be reused)
- Removing the `photosCount` column or changing how it's maintained

## Decisions

### Decision: Search-then-create replaces isActive cursor

**Choice:** When no wave is pre-selected (start of invocation, after season/count boundary), query the user's existing waves for a match before creating a new one.

**Alternatives considered:**
- *Keep isActive as optimization, add search as fallback* — Simpler change, but leaves the stale-cursor mechanism in place. The `isActive` flag becomes dead weight since the search handles all cases. Adds two code paths to maintain.
- *Cluster-then-route (batch router)* — Groups photos by locality+season in-memory, then routes each cluster to a matching wave. More accurate but fundamentally different algorithm, much higher complexity, and allows multiple waves to be filled per call (changes the API contract).

**Rationale:** The search-then-create approach is the minimal change that solves the duplicate wave problem. It replaces the cursor concept entirely, eliminating the stale-cursor bug class. The streaming model (one target wave per invocation) is preserved.

### Decision: findMatchingWave query strategy

**Choice:** Single SQL query with string-match OR `ST_DWithin` fallback, filtered by `createdBy`, `groupingLevel`, and `photosCount < 1000`. Season filtering done in application code after fetch.

The string-match clause varies by groupingLevel:
- DISTRICT: `anchorLocality = $x AND anchorDistrict = $x AND anchorRegion = $x AND anchorCountry = $x`
- CITY: `anchorLocality = $x AND anchorRegion = $x AND anchorCountry = $x`
- REGION: `anchorRegion = $x AND anchorCountry = $x`
- COUNTRY: `anchorCountry = $x`

The `ST_DWithin` fallback uses `DISTANCE_THRESHOLDS_KM[groupingLevel]` (same thresholds as photo-to-wave matching). The query is `ORDER BY "createdAt" DESC` and candidate rows are filtered in code by `getSeasonKey(wave.splashDate) === getSeasonKey(photo.createdAt)`, taking the first match.

**Rationale:** Season computation logic (`getSeasonKey`) uses moment.js with custom year-boundary rules (Dec = same year's winter, Jan/Feb = previous year's winter). Duplicating this in SQL would be fragile. The candidate set is small (user's waves at one groupingLevel, typically <50 rows), so in-code filtering is negligible.

### Decision: Load full frequency distribution on wave resume

**Choice:** When resuming an existing wave, query the locality distribution of its current photos:
```sql
SELECT locality, district, region, country, COUNT(*) as cnt
FROM "WavePhotos" wp JOIN "Photos" p ON p.id = wp."photoId"
WHERE wp."waveUuid" = $1
GROUP BY locality, district, region, country
```
Initialize the frequency maps from this result, then accumulate new photos on top.

**Alternatives considered:**
- *Skip refinement on resume* — Simpler, but if the existing name is wrong (e.g., from a small initial batch), adding many new photos won't fix it.
- *Store frequency maps in the wave row* — Avoids the join query but adds a JSONB column and maintenance complexity.

**Rationale:** One query per resume, hitting the indexed `WavePhotos(waveUuid)` foreign key. Result set is small (distinct locality combinations within one wave). This ensures the refined name always reflects the full photo population.

### Decision: Replace B-tree with GiST on Waves.location

**Choice:** Drop the existing B-tree index, create a GiST index. The B-tree index on a geometry column cannot support spatial operators (`ST_DWithin`, `ST_Distance`, etc.).

**Rationale:** This is a correctness fix, not an optimization. Without GiST, all `ST_DWithin` queries on Waves.location fall back to sequential scan. The new `findMatchingWave` query makes this critical.

### Decision: Add composite index (createdBy, groupingLevel)

**Choice:** `CREATE INDEX idx_waves_owner_level ON "Waves" ("createdBy", "groupingLevel")`. The old single-column `createdBy` index is subsumed by the leftmost prefix of this composite index and can be dropped.

**Rationale:** The `findMatchingWave` query filters on both columns. The composite index narrows results to ~10-50 rows before applying string/spatial filters.

### Decision: Overflow into new wave at count limit

**Choice:** When a matched existing wave reaches 1000 photos during processing, close it and call `findOrCreateWave` for the next photo. This may find another existing wave or create a new one.

**Rationale:** Consistent with current behavior. The 1000-photo limit exists to keep waves manageable. Overflow naturally cascades through the find-or-create mechanism.

### Decision: Most recent wave wins when multiple match

**Choice:** `ORDER BY "createdAt" DESC LIMIT 1` after season filtering. If multiple waves match the same locality+season+level, pick the most recently created one.

**Rationale:** The most recent wave is most likely to be the one the user expects to see growing. Older waves from the same locality may have been manually curated.

## Risks / Trade-offs

- **[Extra query per invocation]** → Every call now runs `findMatchingWave` instead of a simple `isActive` lookup. Mitigated by composite index + small result set. Adds ~1-5ms.
- **[Extra query on resume for frequency distribution]** → One join query per resumed wave. Mitigated by `WavePhotos(waveUuid)` index. Only runs when resuming, not when creating new.
- **[Breaking change: isActive field removed from GraphQL]** → Client apps reading `isActive` will break. Mitigated by: `isActive` has no user-facing purpose (it's an internal cursor). Client can remove the field from queries.
- **[Migration drops column]** → `isActive` column removed. No data loss risk since the column is a boolean flag with no archival value. Rollback: re-add column with `DEFAULT false`.

## Migration Plan

Single migration file with 4 steps:
1. Drop `isActive` column from `Waves`
2. Drop existing B-tree index on `Waves.location`
3. Create GiST index on `Waves.location`
4. Create composite index on `Waves("createdBy", "groupingLevel")`
5. Drop old single-column index on `Waves("createdBy")` (subsumed by composite)

Rollback: reverse all steps (re-add `isActive DEFAULT false`, recreate B-tree, drop GiST, drop composite, re-add single-column).

## Open Questions

_(none — all decisions resolved during exploration)_
