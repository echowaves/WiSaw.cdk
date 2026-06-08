## 1. Backend Fix

- [x] 1.1 In `autoGroupPhotosIntoWaves.ts`, after the main `while` loop and after flushing pending photos, add stale wave detection: if `photosGrouped === 0` and `currentWave != null`, call `closeWave()` to deactivate it
- [x] 1.2 Add test: when all photos are skipped (none match active wave), the active wave is deactivated and `hasMore` is true

## 2. Frontend Safety Valve

- [x] 2.1 In the auto-group `do...while(hasMore)` loop, break when `photosGrouped === 0 && hasMore === true` (client repo — outside this codebase)
