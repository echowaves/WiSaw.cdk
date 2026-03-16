## 1. Fix removePhotoFromWave Controller

- [x] 1.1 Change return type of `main` function from `Promise<Wave>` to `Promise<boolean>` in `lambda-fns/controllers/waves/removePhoto.ts`
- [x] 1.2 Remove the post-delete `SELECT * FROM "Waves"` query
- [x] 1.3 Remove `await psql.clean()` placement and add `return true` after `_updatePhotosCount` call, cleaning up the connection before returning
- [x] 1.4 Remove unused imports: `plainToClass` from `class-transformer` and `Wave` from `../../models/wave`

## 2. Verification

- [x] 2.1 Confirm the file compiles without TypeScript errors
- [x] 2.2 Verify the fix matches the `addPhotoToWave` pattern (returns `true`, calls `psql.clean()` before returning)
