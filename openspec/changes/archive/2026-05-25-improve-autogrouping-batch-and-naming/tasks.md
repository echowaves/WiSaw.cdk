## 1. Increase batch limit

- [x] 1.1 Change `BATCH_LIMIT` from 200 to 1000 in `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`

## 2. Fix wave naming for null-locality photos

- [x] 2.1 In `getMostFrequentLocality`, skip entries where key is `"unknown"` so null-locality photos don't win the frequency count
- [x] 2.2 Update the "Large backlog" test to reflect the new batch limit of 1000
- [x] 2.3 Add test: null-locality photos excluded from most-frequent-locality calculation
- [x] 2.4 Add test: all-null-locality wave returns null from getMostFrequentLocality
- [x] 2.5 Run all auto-group tests and verify they pass
