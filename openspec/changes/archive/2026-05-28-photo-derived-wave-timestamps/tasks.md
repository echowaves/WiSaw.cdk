## 1. Update `_updatePhotosCount` to recalculate timestamps from photo data

- [x] 1.1 In `lambda-fns/controllers/waves/_updatePhotosCount.ts`, modify `_updatePhotosCount` to also compute `MAX("Photos"."createdAt")` in the existing subquery and set `"updatedAt"` and `"freezeDate"` to that value

## 2. Update `createWave` to accept and use photo date

- [x] 2.1 In `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`, add a `photoCreatedAt: string` parameter to the `createWave` function and use it for `createdAt`, `updatedAt`, and `freezeDate` instead of `moment()`

## 3. Pass photo date into `createWave` from callers

- [x] 3.1 In `findOrCreateWave`, pass the current photo's `createdAt` to `createWave` when creating a new wave

## 4. Stop overwriting `updatedAt` in `closeWave`

- [x] 4.1 In the `closeWave` function, remove `"updatedAt" = $6` from the name-refinement UPDATE query (and remove the corresponding `moment()` parameter)

## 5. Verification

- [x] 5.1 Run existing backend tests to confirm no regressions
