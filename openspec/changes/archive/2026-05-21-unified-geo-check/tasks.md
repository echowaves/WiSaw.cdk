## 1. Shared Geo Utilities

- [x] 1.1 Create `lambda-fns/controllers/waves/_isLocationInRadius.ts` — accepts `(lat, lon, waveUuid, radiusKm?)`, runs single `ST_DWithin(ST_MakePoint($lon,$lat)::geography, "location"::geography, radiusMeters)` query against `Waves` table, returns `boolean`
- [x] 1.2 Create `lambda-fns/controllers/waves/_filterPhotosInRadius.ts` — accepts `(photoIds, waveUuid, radiusKm?)`, runs `SELECT "id" FROM "Photos" WHERE "id" = ANY($1) AND ST_DWithin("location"::geography, (SELECT "location"::geography FROM "Waves" WHERE "waveUuid" = $2), $3)`, returns `Set<string>`

## 2. GraphQL Query: isLocationInWave

- [x] 2.1 Add `isLocationInWave(lat: Float!, lon: Float!, waveUuid: String!, uuid: String!): Boolean!` query to `graphql/schema.graphql`
- [x] 2.2 Create `lambda-fns/controllers/waves/isLocationInWave.ts` — validate UUIDs, call `_assertWaveRole(waveUuid, uuid)`, call `_isLocationInRadius(lat, lon, waveUuid)`, return result
- [x] 2.3 Add handler entry for `isLocationInWave` in `lambda-fns/index.ts`
- [x] 2.4 Add resolver entry for `isLocationInWave` in `lib/resources/resolvers.ts`

## 3. Refactor _assertGeoBounds

- [x] 3.1 Refactor `lambda-fns/controllers/waves/_assertGeoBounds.ts` to: check wave has location (existing), fetch photo lat/lon (existing), call `_isLocationInRadius(photoLat, photoLon, waveUuid)`, throw if `false`

## 4. Refactor Auto-Group Distance Fallback

- [x] 4.1 Update `lambda-fns/controllers/waves/_autoGroupGeo.ts` — remove `haversineKm` function, keep `DISTANCE_THRESHOLDS_KM` and string-matching logic, make `fitsPhotoInWave` string-match only (return boolean sync)
- [x] 4.2 Update `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — implement two-pass approach: (1) string-match all photos in batch, (2) call `_filterPhotosInRadius` once for unmatched photo IDs with `DISTANCE_THRESHOLDS_KM[gl]`, (3) walk chronologically accumulating matched photos, flush and create new wave on first miss, repeat with remaining

## 5. Testing

- [x] 5.1 Add test for `isLocationInWave` — coordinates within radius returns `true`, outside returns `false`, non-member gets error
- [x] 5.2 Verify existing auto-group tests pass with the refactored distance fallback
- [x] 5.3 Verify existing `addPhotoToWave` geo-boundary tests pass with refactored `_assertGeoBounds`
