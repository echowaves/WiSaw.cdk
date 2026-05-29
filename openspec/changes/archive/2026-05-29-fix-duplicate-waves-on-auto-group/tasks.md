## 1. Advisory Lock for Concurrency Guard

- [x] 1.1 Add `pg_try_advisory_lock(hashtext('autoGroup:' || $1))` call at the start of `autoGroupPhotosIntoWaves.ts`, after `psql.connect()` and `_assertHasSecret()`. If it returns false, return early with `{ waveUuid: null, name: null, photosGrouped: 0, photosRemaining: -1, wavesCreated: 0, hasMore: true, isNewWave: false }`
- [x] 1.2 Add `pg_advisory_unlock(hashtext('autoGroup:' || $1))` call before `psql.clean()` at the end of the function (both in the normal return path and ensure it runs on early returns)

## 2. Stop Anchor Field Mutation

- [x] 2.1 In `closeWave()`, change the UPDATE query to only set `"name"` — remove `"anchorLocality"`, `"anchorDistrict"`, `"anchorRegion"`, `"anchorCountry"` from the SET clause
- [x] 2.2 In the final flush at the end of `main()` (the second UPDATE near the return), apply the same change — only update `"name"`, remove anchor field columns

## 3. Tests

- [x] 3.1 Add test verifying that when advisory lock cannot be acquired, the function returns `photosGrouped: 0, hasMore: true` without creating any waves
- [x] 3.2 Add test verifying that anchor fields remain unchanged after `closeWave()` name refinement
