## 1. Fix Coordinate Fallbacks

- [x] 1.1 In `startWave()`, replace `photo.lat ?? 0, photo.lon ?? 0` with actual coordinates; use "Unlocated" when both are null
- [x] 1.2 Track `anchorLat`/`anchorLon` in local state so `closeWave()` and final update can use them
- [x] 1.3 In `closeWave()` fallback, use anchor coordinates instead of hardcoded `(0, 0)`; use "Unlocated" if anchor coords are null
- [x] 1.4 In final update fallback, same fix as `closeWave()`

## 2. Tests

- [x] 2.1 Add test verifying `formatCoordinates` is never called with `(0, 0)` in naming paths
