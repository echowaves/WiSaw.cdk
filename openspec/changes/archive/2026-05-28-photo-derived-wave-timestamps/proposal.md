## Why

During auto-grouping, multiple waves are created within the same millisecond, causing `createdAt` and `updatedAt` collisions. The `listWaves` query uses `LIMIT/OFFSET` pagination sorted by these timestamps, so tied values produce duplicate waves across pages. Deriving wave timestamps from the underlying photo dates during auto-grouping gives each wave naturally unique, meaningful timestamps that eliminate pagination duplicates at the source.

## What Changes

- During auto-grouping only: set wave `createdAt` to the first photo's `createdAt` and `updatedAt` to the last photo's `createdAt`, instead of `moment()` wall-clock time
- During auto-grouping: set wave `freezeDate` to the first photo's `createdAt` at creation, then update to `MAX(photo.createdAt)` as photos are added
- `_updatePhotosCount` recalculates `updatedAt = MAX(photo.createdAt)` and `freezeDate = MAX(photo.createdAt)` alongside the existing count subquery
- `closeWave()` name-refinement UPDATE stops setting `updatedAt = moment()`; it is already maintained by `_updatePhotosCount`
- `splashDate` and `_isWaveFrozen` logic remain unchanged (season boundaries)
- All non-auto-grouping operations (manual rename, addPhoto, update) continue using `moment()` for `updatedAt` as before

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auto-group-waves`: Wave `createdAt`/`updatedAt` during auto-grouping are derived from photo timestamps instead of wall-clock time; `freezeDate` tracks `MAX(photo.createdAt)` instead of season-end boundary

## Impact

- **Backend**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — `createWave()` and `closeWave()` timestamp logic
- **Backend**: `lambda-fns/controllers/waves/_updatePhotosCount.ts` — add `MAX`/`MIN` photo date recalculation
- **Frontend**: No changes required
- **APIs**: No schema changes
- **Data**: Existing waves will be wiped and recreated by clients calling auto-group; no migration needed
- **Risk**: Minimal — only affects timestamp assignment during auto-grouping path; all other wave operations unchanged
