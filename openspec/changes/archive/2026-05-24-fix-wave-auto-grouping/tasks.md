## 1. Season Utility

- [x] 1.1 Create `lambda-fns/controllers/waves/_seasonKey.ts` with `getSeasonKey(date: moment.Moment): string` that returns `"YYYY-SEASON"` format (Dec→same year's WINTER, Jan/Feb→previous year's WINTER)
- [x] 1.2 Create `lambda-fns/controllers/waves/_seasonName.ts` with `formatSeasonName(seasonKey: string): string` that returns `"Winter 2025"` from `"2025-WINTER"`
- [x] 1.3 Add unit tests for season key computation (all 12 months, year boundary cases)

## 2. Remove GroupingLevel Default

- [x] 2.1 In `autoGroupPhotosIntoWaves.ts`, remove `DEFAULT_GROUPING_LEVEL` constant and `?? DEFAULT_GROUPING_LEVEL` fallback
- [x] 2.2 Add explicit validation: throw error if `groupingLevel` is null/undefined

## 3. Rewrite Core Grouping Loop

- [x] 3.1 Replace "break on first miss" walk with "skip non-matching" walk — photos that fail both string-match and distance check are skipped (left ungrouped), not used to close the wave
- [x] 3.2 Add season boundary check: compute season key for each matching photo, close wave and start new one when season key differs from active wave's season key
- [x] 3.3 Add 1000-photo limit check: close wave and start new one when photo count reaches 1000
- [x] 3.4 Store season key on the active wave state for comparison during walk

## 4. Update Wave Naming

- [x] 4.1 Replace `formatDateRange` usage with season-based naming: `"<LocalityName>, <Season> <Year>"` (e.g., `"New York, Winter 2025"`)
- [x] 4.2 Update `computeWaveNameFromKey` to accept season key and produce season-format name
- [x] 4.3 Update null-geo fallback naming to use season format: `"40.7°N, 74.0°W, Winter 2025"`
- [x] 4.4 Update final wave UPDATE query to persist the season-format name

## 5. Tests

- [x] 5.1 Update existing auto-group tests to reflect skip-non-matching behavior
- [x] 5.2 Add test: non-matching photos are skipped, not used to break wave
- [x] 5.3 Add test: season boundary closes wave and starts new one
- [x] 5.4 Add test: 1000-photo limit closes wave
- [x] 5.5 Add test: missing groupingLevel throws error
- [x] 5.6 Add test: null-geo photos are skipped then self-grouped on subsequent call
