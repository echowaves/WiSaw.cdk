## Context

The codebase currently has two independent geo-distance checking systems:

1. **`_assertGeoBounds.ts`** — Used by `addPhotoToWave`. Performs 3 separate SQL queries (fetch wave, fetch photo, run `ST_DWithin`). Uses the wave's stored `radius` column. Geodesic precision via PostGIS `geography` type. Throws on failure.

2. **`_autoGroupGeo.ts`** — Used by `autoGroupPhotosIntoWaves`. Performs string-matching first, then falls back to JavaScript `haversineKm()` with hardcoded `DISTANCE_THRESHOLDS_KM` per grouping level (15/50/300/2000 km). Spherical approximation. Returns boolean. Runs in-memory per photo.

A new client requirement adds a third consumer: the mobile app needs to check whether the user's current GPS coordinates have drifted outside the active wave's boundary, so photos aren't uploaded to the wrong wave.

## Goals / Non-Goals

**Goals:**
- Unify geo-distance checking into a single PostGIS-based SQL pattern
- Expose an `isLocationInWave` GraphQL query for client drift detection
- Refactor `_assertGeoBounds` and auto-group distance fallback to use the shared utility
- Provide a batch variant for auto-group to avoid N+1 queries
- Maintain auto-group's string-match-first behavior and existing thresholds

**Non-Goals:**
- Changing auto-group's string-matching logic
- Modifying wave radius defaults or grouping level thresholds
- Adding client-side distance checking (client will use server query)
- Enabling AppSync caching on the new query

## Decisions

### 1. SQL-first approach over TypeScript utility

**Decision**: The shared geo-check is a SQL pattern (`ST_DWithin`), not a TypeScript wrapper around haversine.

**Alternatives considered**:
- *TypeScript utility with haversine*: Would maintain in-memory performance but loses geodesic precision and doesn't reuse PostGIS investment.
- *Shared TypeScript function calling PostGIS*: Would work for single-point checks but introduces per-photo DB round-trips in auto-group.

**Rationale**: PostGIS is already a dependency, the `location` columns are `GEOMETRY('POINT')`, and `ST_DWithin` on `geography` gives geodesic precision. The SQL pattern can be embedded in both single-point queries and batch queries naturally.

### 2. Two shared utilities: single-point and batch

**Decision**: Create `_isLocationInRadius(lat, lon, waveUuid, radiusKm?)` for single-point checks and `_filterPhotosInRadius(photoIds, waveUuid, radiusKm?)` for batch checks.

- `_isLocationInRadius`: Takes raw coordinates, runs one `SELECT ST_DWithin(ST_MakePoint($lon,$lat)::geography, ...)`. Used by `isLocationInWave` query and `_assertGeoBounds`.
- `_filterPhotosInRadius`: Takes an array of photo IDs, runs `SELECT id FROM "Photos" WHERE id = ANY($1) AND ST_DWithin(...)`. Used by auto-group for the distance fallback path. Returns the subset of IDs that are within range.

Both accept an optional `radiusKm` parameter. When omitted, the wave's stored `radius` is used. When provided (auto-group passes `DISTANCE_THRESHOLDS_KM[groupingLevel]`), that value overrides.

**Rationale**: The single-point variant avoids looking up a photo by ID (the new query has no photo, just coordinates). The batch variant avoids N round-trips in auto-group (1 query per wave instead of 1 per photo).

### 3. Auto-group two-pass approach

**Decision**: Auto-group's photo loop becomes:
1. **Pass 1 (sync, in-memory)**: String-match each photo against the active wave using existing `stringMatchesGroupingLevel`. Partition into `matched[]` and `unmatched[]`.
2. **Pass 2 (one DB query)**: Call `_filterPhotosInRadius(unmatchedIds, waveUuid, DISTANCE_THRESHOLDS_KM[gl])` to get the set of unmatched photo IDs that are within the threshold distance.
3. **Walk chronologically**: Iterate photos in order. If string-matched or in the ST_DWithin set, accumulate for the current wave. On the first photo that fails both checks, flush the accumulated batch, create a new wave, and repeat from pass 1 with remaining photos.

**Rationale**: This preserves chronological wave creation (photos are processed in `createdAt` order, and a drift starts a new wave). The batch query runs at most once per wave created — typically 1-2 per 200-photo batch.

### 4. `isLocationInWave` query requires membership

**Decision**: The query validates `uuid` via `_assertWaveRole(waveUuid, uuid)` before performing the geo-check. Non-members get an error.

**Rationale**: Consistent with all other wave queries (`getWave`, `listWaveMembers`, etc.) which require membership. Prevents leaking wave location/radius information to non-members.

### 5. `_assertGeoBounds` delegates to shared utility

**Decision**: Refactor `_assertGeoBounds` to: (1) check wave has location (existing logic), (2) check photo has location (existing logic), (3) call `_isLocationInRadius(photoLat, photoLon, waveUuid)` instead of its own inline `ST_DWithin`. Throw on `false`.

**Rationale**: Reduces the 3-query pattern to 2 queries (photo lookup + shared utility which handles the wave lookup internally). Same behavior, less code duplication.

## Risks / Trade-offs

- **Auto-group distance fallback now hits DB** → Previously pure in-memory math. Mitigated by batching — one query per wave, not per photo. For the typical case (1-2 waves per 200-photo batch), this is 1-2 additional queries, well within the existing ~5 queries per invocation.
- **Precision change in auto-group** → Switching from haversine (spherical) to `ST_DWithin` on `geography` (geodesic) may cause marginal differences at boundary cases. The difference is <0.5% at the distances involved (15-2000 km). This is an improvement, not a regression.
- **`fitsPhotoInWave` becomes async** → The function signature changes since it now conditionally calls the DB. Auto-group's loop structure needs adjustment to accommodate the two-pass approach.
