## 1. Fix getPhotoAllNext

- [x] 1.1 In `lambda-fns/controllers/photos/getPhotoAllNext.ts`, replace the `|| '0'` fallback with an early return of `{ photo: null, comments: [], recognitions: [] }` when no next photo exists

## 2. Fix getPhotoAllPrev

- [x] 2.1 In `lambda-fns/controllers/photos/getPhotoAllPrev.ts`, replace the `|| '2147483640'` fallback with an early return of `{ photo: null, comments: [], recognitions: [] }` when no previous photo exists
