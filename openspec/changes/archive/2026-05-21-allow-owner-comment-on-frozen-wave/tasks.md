## 1. Rename and rewrite frozen wave check utility

- [x] 1.1 Create `_isPhotoInFrozenWaveForUser(photoId, uuid)` with LEFT JOIN on WaveUsers to check owner/facilitator status in a single query
- [x] 1.2 Keep `_isPhotoInFrozenWave(photoId)` for strict delete checks (unfreezing required)

## 2. Update comment create controller

- [x] 2.1 Replace import of `_isPhotoInFrozenWave` with `_isPhotoInFrozenWaveForUser` in `comments/create.ts`
- [x] 2.2 Pass `uuid` parameter to the frozen wave check call

## 3. Verify comment delete controller

- [x] 3.1 Confirm `comments/delete.ts` uses strict `_isPhotoInFrozenWave` (no uuid passed) — unfreezing required as stop-gap
