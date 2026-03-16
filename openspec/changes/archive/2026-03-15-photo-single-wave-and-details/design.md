## Context

The `WavePhotos` table uses a composite PK `(waveUuid, photoId)` which prevents adding the same photo to the same wave twice, but does not prevent adding a photo to multiple different waves. The intended behavior is one wave per photo. `getPhotoDetails` currently returns comments, recognitions, and watch status — no wave info.

## Goals / Non-Goals

**Goals:**
- Prevent a photo from being added to a wave if it's already in another wave (app-level check in `addPhotoToWave`)
- Return `waveName` and `waveUuid` in `PhotoDetails` so clients know which wave a photo belongs to

**Non-Goals:**
- DB-level unique constraint on `photoId` in `WavePhotos` (deferred for now)
- Moving a photo between waves in a single operation (client can remove then add)
- Changing `autoGroupPhotosIntoWaves` (already operates on ungrouped photos only)

## Decisions

1. **App-level enforcement over DB constraint**: Check for existing `WavePhotos` row before insert in `addPhotoToWave`. Throw an error if found. This keeps the change simple and reversible without a migration. Alternative: `UNIQUE` constraint on `photoId` — stronger but requires a migration and careful handling of any existing duplicates.

2. **Wave info as part of PhotoDetails, not a separate query**: Add `waveName` and `waveUuid` to the existing `PhotoDetails` type rather than creating a new GraphQL query. This lets the client get wave info in the same call it already makes. Alternative: separate `getPhotoWave(photoId)` query — adds API surface without benefit.

3. **New `_getWaveInfo` helper in photos controllers**: Follows the existing pattern of `_getComments`, `_getRecognitions`, `_isPhotoWatched` helpers. The helper queries `WavePhotos JOIN Waves` and returns `{ waveName, waveUuid }` or nulls. Runs in parallel with existing queries via `Promise.all`.

## Risks / Trade-offs

- [App-level only enforcement] → Race conditions could allow duplicates under concurrent requests. Mitigation: acceptable for current single-user-per-device model; DB constraint can be added later.
- [No migration for existing data] → Existing data may have photos in multiple waves (from `autoGroupPhotosIntoWaves` which already prevents this, so unlikely). Mitigation: `autoGroupPhotosIntoWaves` already filters `WHERE "WavePhotos"."photoId" IS NULL`, so no existing duplicates expected.
