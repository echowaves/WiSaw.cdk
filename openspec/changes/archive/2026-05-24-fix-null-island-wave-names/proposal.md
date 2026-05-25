## Why

Wave names display "0.0°N, 0.0°E" (Null Island) when a photo's geocoding fields are null, even if the photo has valid coordinates. The coordinate fallback in wave naming hardcodes `(0, 0)` instead of using the photo's or wave's actual coordinates.

## What Changes

- **Fix `startWave()` fallback**: Use the photo's actual coordinates (or "Unlocated" if truly null) instead of `photo.lat ?? 0`
- **Fix `closeWave()` fallback**: Use the wave's anchor coordinates instead of hardcoded `(0, 0)`
- **Fix final update fallback**: Same as `closeWave()` — use wave anchor coordinates

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auto-group-photos`: Fix wave name fallback to use actual coordinates instead of hardcoded (0, 0) when geocoding strings are null

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — 3 coordinate fallback sites
