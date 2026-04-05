## 1. Modify deletePhoto Controller

- [ ] 1.1 Replace the blanket `_isPhotoInFrozenWave(photoId)` check in `lambda-fns/controllers/photos/delete.ts` with an inline query that JOINs `WavePhotos` → `Waves` → `WaveUsers` to fetch frozen status, `endDate`, and the caller's role in one query. If the photo is in a frozen wave and the caller is NOT the owner of that wave, throw the existing error. If the caller IS the owner, allow the deletion to proceed.
- [ ] 1.2 Verify the `_updatePhotosCount` call still runs correctly after the change (photo in frozen wave that gets soft-deleted should still update the wave's count).
- [ ] 1.3 Run `npx tsc --noEmit` to confirm no type errors.
