## Why

The auto-grouping algorithm produces waves that are too small (only a few photos each), even at REGION or COUNTRY level, because it relies on strict string equality of reverse-geocoded locality fields. When the geocoder returns inconsistent strings for nearby locations (e.g., "Paris" vs "Paris 9e Arrondissement") or when geocoding fails entirely (empty strings), photos that should belong together are split into separate tiny waves. Additionally, for users with many ungrouped photos the mutation times out at 30 seconds because it processes all photos in a single invocation with O(N) individual DB queries.

## What Changes

- Add a **spatial distance fallback** to `fitsPhotoInWave`: when string matching fails, check if the photo is within a level-appropriate distance threshold of the wave's anchor point using Haversine distance (no extra DB queries — coordinates are already fetched)
- Define **distance thresholds per grouping level**: DISTRICT ≤ 15 km, CITY ≤ 50 km, REGION ≤ 300 km, COUNTRY ≤ 2000 km
- Add **batch processing** with a configurable limit (e.g., 200 photos per invocation), properly returning `hasMore: true` and `photosRemaining` count so the client can call repeatedly
- **Fix frequency map bug**: reset `localityCounts`, `districtCounts`, and related maps when creating a new wave, so refinement data from a previous wave doesn't corrupt the next one
- **Bulk INSERT optimisation**: collect photo IDs for the current wave and insert them into `WavePhotos` in a single multi-row INSERT instead of one query per photo

## Capabilities

### New Capabilities

_None — this change modifies existing behaviour only._

### Modified Capabilities

- `auto-group-photos`: Adding spatial distance fallback to field matching, batch processing with proper `hasMore`/`photosRemaining`, frequency map reset on wave boundary, and bulk INSERT for performance

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — main algorithm changes
- **APIs**: No schema changes; the `AutoGroupResult` type already has `hasMore` and `photosRemaining` fields. Client must be updated to call the mutation in a loop when `hasMore` is true.
- **Dependencies**: None — Haversine is computed in-process, no new packages
- **Systems**: Reduces DB load per invocation; improves Lambda execution time
