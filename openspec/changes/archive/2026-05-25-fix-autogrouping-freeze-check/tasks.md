## 1. Fix findMatchingWave freeze check

- [x] 1.1 In `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`, replace `!_isWaveFrozen(wave)` with `wave.freezeMode !== 'FROZEN'` in the `findMatchingWave` season-filter loop (~line 310)
- [x] 1.2 Remove the `_isWaveFrozen` import if no longer used in this file

## 2. Update tests

- [x] 2.1 Add test case: historical wave (date-frozen, `freezeMode` AUTO/null) is reused across batches
- [x] 2.2 Add test case: explicitly frozen wave (`freezeMode = 'FROZEN'`) is skipped by auto-grouping
- [x] 2.3 Verify existing auto-group tests still pass
