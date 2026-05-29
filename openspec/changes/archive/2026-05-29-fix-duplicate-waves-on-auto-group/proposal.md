## Why

Concurrent calls to `autoGroupPhotosIntoWaves` for the same user create duplicate waves. Both calls read the same ungrouped photos before either has created a wave, so each creates its own wave and splits the photos between them via `ON CONFLICT DO NOTHING`. Production data confirms all 8 duplicate wave pairs were created at the exact same millisecond with the exact same first photo. A secondary issue — `closeWave()` mutating anchor fields to null when all photos lack locality data — could cause cross-batch duplicates in edge cases.

## What Changes

- Add a PostgreSQL advisory lock per user in `autoGroupPhotosIntoWaves` to prevent concurrent execution; if the lock is already held, return early with `photosGrouped: 0, hasMore: true`
- Stop mutating anchor fields (`anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`) in `closeWave()` and the final flush — only update the wave `name` (display field), leaving anchors as stable matching identity

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auto-group-photos`: Add concurrency guard (advisory lock) and stop anchor mutation to prevent duplicate wave creation

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — two changes: advisory lock at entry, remove anchor columns from UPDATE statements in `closeWave()` and final flush
- **APIs**: No GraphQL schema changes. The `AutoGroupResult` return type gains no new fields; the only behavioral change is that concurrent calls return early instead of creating duplicates
- **Database**: No migrations needed — uses PostgreSQL's built-in `pg_try_advisory_lock`
- **Risk**: Low — advisory lock is session-scoped and auto-released on disconnect; anchor freeze is strictly safer than current mutation behavior
