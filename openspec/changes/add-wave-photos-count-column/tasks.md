## 1. Database Migrations

- [ ] 1.1 Create migration `20260315120000-add-wave-photos-count.js` to add `photosCount` INTEGER column (default 0, NOT NULL) to `Waves` table
- [ ] 1.2 Create migration `20260315120001-populate-wave-photos-count.js` to populate existing `photosCount` values from `WavePhotos` + active `Photos`

## 2. Shared Helper

- [ ] 2.1 Create `lambda-fns/controllers/waves/_updatePhotosCount.ts` with a recount helper that updates `Waves.photosCount` using a COUNT(*) subquery on `WavePhotos` + active `Photos`

## 3. Update Write Paths

- [ ] 3.1 Call `_updatePhotosCount` in `addPhoto.ts` after the INSERT
- [ ] 3.2 Call `_updatePhotosCount` in `removePhoto.ts` after the DELETE
- [ ] 3.3 Call `_updatePhotosCount` in `autoGroupPhotosIntoWaves.ts` after each wave is populated
- [ ] 3.4 Update `processDeletedImage/index.ts` to query affected waveUuids before deleting WavePhotos, then call `_updatePhotosCount` for each

## 4. Simplify listWaves

- [ ] 4.1 Remove the window function photos count logic from `listWaves.ts` and read `photosCount` directly from the `Waves` row
