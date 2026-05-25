## 1. Database Migration

- [x] 1.1 Create migration to drop `isActive` column from `Waves` table
- [x] 1.2 In same migration, drop existing B-tree index on `Waves.location` and create GiST index
- [x] 1.3 In same migration, create composite index on `Waves("createdBy", "groupingLevel")` and drop old single-column `Waves("createdBy")` index

## 2. GraphQL Schema & Model

- [x] 2.1 Remove `isActive: Boolean!` from `Wave` type in `graphql/schema.graphql`
- [x] 2.2 Remove `isActive` field from `lambda-fns/models/wave.ts`

## 3. Implement findOrCreateWave

- [x] 3.1 Create `findMatchingWave` function: query existing waves by `createdBy`, `groupingLevel`, anchor field string match (scoped by level) OR `ST_DWithin` distance fallback, `photosCount < 1000`, `ORDER BY createdAt DESC`; filter by season in code; return most recent match or null
- [x] 3.2 Create `loadFrequencyDistribution` function: query `WavePhotos` JOIN `Photos` grouped by `locality, district, region, country` for a given `waveUuid`; return initialized frequency maps (localityCounts, districtCounts, regionCounts, countryCounts, districtMap, regionMap, countryMap)
- [x] 3.3 Create `findOrCreateWave` function: call `findMatchingWave`; if found, load wave state (photo count, anchor coords, season key) and call `loadFrequencyDistribution` to initialize frequency maps; if not found, call existing `createWave` and initialize empty maps
- [x] 3.4 Replace `startWave` function with `findOrCreateWave` at all call sites (initial wave selection, season boundary, count overflow)

## 4. Remove isActive Logic

- [x] 4.1 Remove the active wave query (`SELECT * FROM Waves WHERE createdBy = $1 AND isActive = true`)
- [x] 4.2 Remove `isActive: true` assignment in the in-memory `activeWave` object
- [x] 4.3 Remove `SET "isActive" = false` from `closeWave`
- [x] 4.4 Remove `SET "isActive" = true` from `createWave` function's INSERT statement
- [x] 4.5 Remove stale wave detection block (`if photosGrouped === 0 && activeWave != null → closeWave()`)

## 5. Restructure Main Loop

- [x] 5.1 Replace initial active wave loading with `findOrCreateWave(photos[0])` call
- [x] 5.2 Update season boundary handler to call `findOrCreateWave` instead of `startWave`
- [x] 5.3 Update count overflow handler to call `findOrCreateWave` instead of `startWave`
- [x] 5.4 Update `computeMatches` to work with the wave returned by `findOrCreateWave` (no dependency on `activeWave` query)

## 6. Tests

- [x] 6.1 Add test: `findMatchingWave` returns null when no matching wave exists
- [x] 6.2 Add test: `findMatchingWave` matches by string fields scoped to groupingLevel
- [x] 6.3 Add test: `findMatchingWave` uses distance fallback when string match fails
- [x] 6.4 Add test: `findMatchingWave` filters by season (same locality, different season → no match)
- [x] 6.5 Add test: `findMatchingWave` picks most recent wave when multiple match
- [x] 6.6 Add test: `findMatchingWave` skips waves with photosCount >= 1000
- [x] 6.7 Add test: frequency distribution loaded on resume includes existing photos
- [x] 6.8 Add test: name refinement on resume considers all photos (existing + new batch)
- [x] 6.9 Update existing stale wave detection tests to verify no-stale-cursor behavior (always groups at least first photo)
- [x] 6.10 Run full test suite (auto-group + season-key) to verify no regressions
