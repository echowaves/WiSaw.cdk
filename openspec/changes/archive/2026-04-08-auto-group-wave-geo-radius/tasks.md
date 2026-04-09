## 1. Compute radius from cluster spread

- [x] 1.1 Add a `computeClusterRadius` function that takes anchor coords and collected photos array, computes max haversine distance from anchor to each geolocated photo, and returns `max(maxDist * 1.2, maxDist + 10, 5)`
- [x] 1.2 In the geo-located branch, call `computeClusterRadius` and pass the result to `createWaveAndAssign` instead of hardcoded `100`
- [x] 1.3 In the locationless-only branch, keep `radius` unchanged (wave has no location, geo-fence doesn't apply)
