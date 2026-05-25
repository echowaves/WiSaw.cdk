## 1. Season Boundary Helper

- [x] 1.1 Add `getSeasonBoundaries(seasonKey)` function to `lambda-fns/controllers/waves/_seasonKey.ts` that parses `YYYY-SEASON` and returns `{ splashDate, freezeDate }` as formatted strings, using `moment().endOf('month')` for freeze dates
- [x] 1.2 Add tests for `getSeasonBoundaries` in `tests/season-key.js`: spring, summer, fall, winter (year-spanning), winter with leap year

## 2. Auto-Group Integration

- [x] 2.1 Import `getSeasonBoundaries` and `_isWaveFrozen` in `autoGroupPhotosIntoWaves.ts`
- [x] 2.2 In `findOrCreateWave`, replace `photoDate` splash/freeze args with season boundary dates from `getSeasonBoundaries(photoSeasonKey)`
- [x] 2.3 In `findMatchingWave` loop, add `_isWaveFrozen(wave)` check to skip frozen waves

## 3. Tests

- [x] 3.1 Add test in `tests/auto-group.js`: new wave gets season-aligned splash/freeze dates (not photo date)
- [x] 3.2 Add test in `tests/auto-group.js`: `findMatchingWave` skips frozen waves (AUTO mode, past freeze date)
- [x] 3.3 Add test in `tests/auto-group.js`: `findMatchingWave` skips manually frozen waves (`freezeMode=FROZEN`)
- [x] 3.4 Add test in `tests/auto-group.js`: `findMatchingWave` reuses unfrozen wave in current season
- [x] 3.5 Run full test suite and verify all tests pass
