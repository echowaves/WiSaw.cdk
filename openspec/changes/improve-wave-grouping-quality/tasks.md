## 1. Change geocoding failure behavior in main function

- [x] 1.1 When geocoding fails, check if the user has existing waves (query `Waves` via `WaveUsers`)
- [x] 1.2 If existing waves exist, assign the failed cluster's photos to the nearest wave in time (reuse the time-distance-to-midpoint logic from `handleUnresolvablePhotos`)
- [x] 1.3 If no existing waves exist, create `"Uncategorized, <DateRange>"` wave as catch-all (current behavior, kept only for this case)
- [x] 1.4 Return correct `photosGrouped`, `photosRemaining`, and `hasMore` for both paths

## 2. Extract shared assign-to-nearest-wave logic

- [x] 2.1 Extract the "assign photos to nearest wave by time proximity" logic into a reusable function that both the geocoding-failure path and `handleUnresolvablePhotos` can call

## 3. Verification

- [x] 3.1 Verify that geocoding failure with existing waves absorbs photos instead of creating "Uncategorized" wave
- [x] 3.2 Verify that geocoding failure with no existing waves still creates "Uncategorized" catch-all
- [x] 3.3 Verify one HTTP call max per invocation is maintained
- [x] 3.4 Verify locationless photo handling still works on final pass
