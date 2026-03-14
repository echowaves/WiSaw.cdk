## Why

The 50km distance threshold for grouping photos into waves is too tight — it splits photos from the same general area (e.g., a day trip) into separate waves. Increasing to 100km produces more natural groupings.

## What Changes

- Change `DISTANCE_THRESHOLD_KM` from `50` to `100` in `autoGroupPhotosIntoWaves.ts`

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Distance threshold for wave boundary detection changes from 50km to 100km

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — one constant change
