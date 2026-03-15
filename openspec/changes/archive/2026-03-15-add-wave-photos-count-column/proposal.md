## Why

The `photosCount` for each wave is currently computed at query time using SQL window functions in `listWaves`. This is wasteful — it recalculates on every list request. A persistent `photosCount` column on the `Waves` table, automatically updated when photos are added or removed, is more efficient and follows the existing pattern used by `Photos.commentsCount`.

## What Changes

- Add a `photosCount` integer column (default 0) to the `Waves` table via migration
- Populate existing counts from `WavePhotos` via a data migration
- Create a shared `_updatePhotosCount` helper that recounts active photos for a wave
- Call `_updatePhotosCount` from all code paths that modify `WavePhotos`: `addPhoto`, `removePhoto`, `autoGroupPhotosIntoWaves`, `processDeletedImage`, and wave `delete`
- Simplify `listWaves` to read `photosCount` directly from the `Waves` row instead of computing it with window functions

## Capabilities

### New Capabilities

### Modified Capabilities
- `waves`: `photosCount` becomes a persisted DB column auto-updated on photo add/remove

## Impact

- `migrations/` — two new migration files (add column, populate existing counts)
- `lambda-fns/controllers/waves/_updatePhotosCount.ts` — new shared helper
- `lambda-fns/controllers/waves/addPhoto.ts` — call `_updatePhotosCount` after insert
- `lambda-fns/controllers/waves/removePhoto.ts` — call `_updatePhotosCount` after delete
- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — call `_updatePhotosCount` after grouping
- `lambda-fns/lambdas/processDeletedImage/index.ts` — call `_updatePhotosCount` after cleanup
- `lambda-fns/controllers/waves/listWaves.ts` — simplify to read `photosCount` from wave row
