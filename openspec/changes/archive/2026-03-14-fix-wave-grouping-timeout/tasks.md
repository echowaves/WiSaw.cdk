## 1. Remove geocoding loop — geocode only oldest cluster

- [x] 1.1 Replace the `for` loop over `allTemporalClusters` with a single geocode call on `allTemporalClusters[0]`
- [x] 1.2 On geocoding failure, use `"Uncategorized, <DateRange>"` as the wave name and set location to NULL (use `createWaveAndAssign` with null lon/lat)

## 2. Simplify unresolvable photo flow

- [x] 2.1 Remove the `geocodedCluster == null` branch that called `handleUnresolvablePhotos` after the geocoding loop — the oldest cluster now always creates a wave
- [x] 2.2 Ensure `handleUnresolvablePhotos` only runs when `photos.length === 0` (no located ungrouped photos), handling only locationless photos

## 3. Verification

- [x] 3.1 Verify the function makes at most one HTTP call per invocation
- [x] 3.2 Verify geocoding failure produces an "Uncategorized" wave instead of timing out
- [x] 3.3 Verify locationless photos are still assigned to nearest wave on the final pass
