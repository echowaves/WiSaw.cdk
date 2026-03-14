## Why

The current `autoGroupPhotosIntoWaves` uses DBSCAN spatial clustering then temporal splitting, which produces fragmented results — too many small "Uncategorized" waves, absorb logic that causes duplicate-key errors on the client, and ~440 lines of complex code. A time-first approach that walks the timeline and breaks on location changes is simpler, more intuitive, and produces better wave boundaries.

## What Changes

- **Rewrite `autoGroupPhotosIntoWaves`** from scratch with a time-first algorithm:
  1. Query up to 1000 oldest ungrouped photos sorted by date
  2. Find the anchor (first photo with a location)
  3. Walk forward collecting photos: include if within 50km of anchor or locationless; stop at first photo >50km away
  4. If no anchor (all locationless), include all photos as one "Uncategorized" wave
  5. Reverse geocode anchor → wave name = "LocationName, DateRange"
  6. Create wave and assign collected photos
- **Remove** DBSCAN spatial clustering, temporal gap splitting, absorb-into-existing-wave logic, `isNewWave` flag
- **Remove `isNewWave` from `AutoGroupResult`** — every invocation creates exactly one new wave or returns `photosGrouped: 0` **BREAKING**
- **Cap wave size at 1000 photos** per invocation

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Completely new algorithm — time-first walk with location-break boundaries instead of DBSCAN + temporal splitting. Locationless photos within the wave's date range are included automatically. Max 1000 photos per wave.

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — full rewrite
- **APIs**: `graphql/schema.graphql` — remove `isNewWave` from `AutoGroupResult`
- **Client**: Remove `isNewWave` handling; every result with `photosGrouped > 0` is a new wave to append
