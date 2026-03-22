## 1. Shared Utility

- [x] 1.1 Create `lambda-fns/utilities/isValidPhotoId.ts` with regex-based UUID format validation for photo IDs

## 2. Fix Broken Controllers (replace strict with relaxed photoId validation)

- [x] 2.1 Replace `uuidValidate(photoId)` with `isValidPhotoId(photoId)` in `lambda-fns/controllers/waves/addPhoto.ts` (keep `uuidValidate` for `waveUuid` and `uuid`)
- [x] 2.2 Replace `uuidValidate(photoId)` with `isValidPhotoId(photoId)` in `lambda-fns/controllers/waves/removePhoto.ts` (keep `uuidValidate` for `waveUuid`)

## 3. Add Validation to Unvalidated Controllers (consistency & input safety)

- [x] 3.1 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/photos/delete.ts`
- [x] 3.2 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/photos/watch.ts`
- [x] 3.3 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/photos/unwatch.ts`
- [x] 3.4 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/photos/getPhotoDetails.ts`
- [x] 3.5 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/photos/getPhotoAllCurr.ts`
- [x] 3.6 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/photos/getPhotoAllNext.ts`
- [x] 3.7 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/photos/getPhotoAllPrev.ts`
- [x] 3.8 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/abuseReports/create.ts`
- [x] 3.9 Add `isValidPhotoId(photoId)` guard to `lambda-fns/controllers/comments/create.ts`
