## Why

The codebase has two independent geo-distance systems: `_assertGeoBounds` uses PostGIS `ST_DWithin` (geodesic precision) while `_autoGroupGeo.fitsPhotoInWave` uses a JavaScript haversine function (spherical approximation). Both solve the same problem — "is a location within a wave's geographic area?" — but with different precision, different code paths, and no reuse. Additionally, the client needs a new query to check whether the user's current GPS coordinates have drifted outside the active wave's boundary, so they can be warned before uploading a photo that won't fit.

## What Changes

- Add a shared PostGIS utility `_isLocationInRadius(lat, lon, waveUuid, radiusKm?)` that performs a single `ST_DWithin` query. When `radiusKm` is omitted, it uses the wave's stored `radius`. When provided, it uses the explicit value (for auto-group thresholds).
- Add a batch variant `_filterPhotosInRadius(photoIds, waveUuid, radiusKm?)` that checks multiple photos against a wave in a single `WHERE id = ANY(...)` query, returning the subset of IDs that fall within range.
- Add a new `isLocationInWave(lat, lon, waveUuid, uuid)` GraphQL query that verifies caller membership and returns `Boolean!` indicating whether the given coordinates fall within the wave's radius.
- Refactor `_assertGeoBounds` to delegate to `_isLocationInRadius` instead of inlining its own `ST_DWithin` query.
- Refactor `autoGroupPhotosIntoWaves` to use `_filterPhotosInRadius` for the distance fallback (replacing in-memory haversine), keeping string-match-first logic unchanged. The auto-group loop becomes a two-pass approach: synchronous string matching, then one batch `ST_DWithin` query per wave for non-matched photos.
- `haversineKm` in `_autoGroupGeo.ts` can be removed once no longer referenced. `DISTANCE_THRESHOLDS_KM` stays — it's passed as `radiusKm` to the batch utility.

## Capabilities

### New Capabilities
- `is-location-in-wave`: Client-facing query to check if GPS coordinates fall within a wave's geo-boundary, with membership verification.

### Modified Capabilities
- `wave-moderation`: Geo-boundary enforcement (`_assertGeoBounds`) refactored to use shared `_isLocationInRadius` utility. Same behavior, different implementation.
- `auto-group-photos`: Distance fallback in `fitsPhotoInWave` replaced with PostGIS `ST_DWithin` via batch utility. String-match-first logic unchanged. Gains geodesic precision; thresholds (15/50/300/2000 km) unchanged.

## Impact

- **New files**: `lambda-fns/controllers/waves/_isLocationInRadius.ts`, `lambda-fns/controllers/waves/_filterPhotosInRadius.ts`, `lambda-fns/controllers/waves/isLocationInWave.ts`
- **Modified files**: `_assertGeoBounds.ts`, `_autoGroupGeo.ts`, `autoGroupPhotosIntoWaves.ts`, `schema.graphql`, `index.ts`, `resolvers.ts`
- **APIs**: New `isLocationInWave` query — additive, no breaking changes
- **Dependencies**: None — PostGIS already available
- **Performance**: Auto-group changes from N haversine calls to 1-2 `ST_DWithin` batch queries per 200-photo batch. New query is a single indexed PostGIS lookup.
