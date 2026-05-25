## Why

Auto-grouped waves currently set both `splashDate` and `freezeDate` to the photo's `createdAt` date, which is in the past. With `freezeMode=AUTO`, this means `now > freezeDate` is immediately true — every auto-grouped wave is frozen the instant it's created. Waves should remain unfrozen during their season so users can add/remove photos, and freeze automatically when the season ends.

## What Changes

- Add a `getSeasonBoundaries(seasonKey)` helper that computes exact start/end timestamps for a season (e.g., `2026-SPRING` → Mar 1 00:00:00.000 to May 31 23:59:59.999), handling leap years via `moment().endOf('month')`
- Auto-grouped wave creation uses season boundaries for `splashDate`/`freezeDate` instead of the photo's `createdAt`
- `findMatchingWave` skips frozen waves when searching for a wave to reuse, so manually frozen waves and old waves with broken dates are not reused
- No migration — existing waves keep their current dates

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `season-wave-boundaries`: Add requirement for season boundary date computation and its use as wave splash/freeze dates
- `auto-group-photos`: Add requirement that `findMatchingWave` skips frozen waves

## Impact

- `lambda-fns/controllers/waves/_seasonKey.ts` — new `getSeasonBoundaries()` export
- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — `findOrCreateWave` passes season dates to `createWave`; `findMatchingWave` filters out frozen waves
- `tests/season-key.js` — new tests for `getSeasonBoundaries`
- `tests/auto-group.js` — new tests for frozen-wave skipping
