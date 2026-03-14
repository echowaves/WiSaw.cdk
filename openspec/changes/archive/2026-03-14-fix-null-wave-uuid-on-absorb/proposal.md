## Why

When `autoGroupPhotosIntoWaves` absorbs photos into existing waves (geocoding failure or locationless photo handling), it returns `waveUuid: null`. The client uses `waveUuid` as a React list key, causing duplicate `null` key errors and potential UI corruption when multiple absorb results accumulate in the wave list.

## What Changes

- `assignPhotosToNearestWave` now tracks which wave received the most photos and returns its UUID
- The absorb paths in both the main function and `handleUnresolvablePhotos` return the primary target wave's UUID and name instead of null
- The `AutoGroupResult` always contains a non-null `waveUuid` when `photosGrouped > 0`

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Absorb results now return the UUID and name of the wave that received the most photos instead of null

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — change return type of `assignPhotosToNearestWave`, update callers
- **APIs**: No GraphQL schema changes; `AutoGroupResult` type is unchanged, just the null contract tightened
- **Client**: Fixes the duplicate key error in the Waves FlatList
