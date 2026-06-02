## 1. Update createWave call site

- [x] 1.1 In `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`, change the `createWave` call in `findOrCreateWave` to pass `photo.createdAt` as `splashDate` and `moment(photo.createdAt).add(1, 'month').format('YYYY-MM-DD HH:mm:ss.SSS')` as `freezeDate` (instead of `seasonDates.splashDate` and `seasonDates.freezeDate`)

## 2. Update _updatePhotosCount to add grace period

- [x] 2.1 In `lambda-fns/controllers/waves/_updatePhotosCount.ts`, change the `freezeDate` UPDATE from `sub.last_photo_date` to `sub.last_photo_date + INTERVAL '1 month'`

## 3. Update tests

- [x] 3.1 In `tests/auto-group.js`, update the test "new wave gets season-aligned splash/freeze dates" to assert photo-derived dates (splashDate = first photo's createdAt, freezeDate = first photo's createdAt + 1 month)
- [x] 3.2 Add a test scenario: "adding photos shifts freezeDate forward by 1 month"
- [x] 3.3 Add a test scenario: "adding older photos does not shift freezeDate backward"
- [x] 3.4 Run full test suite and verify all tests pass
