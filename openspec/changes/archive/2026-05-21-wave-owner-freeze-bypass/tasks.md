## 1. Allow owner to add photos to frozen waves

- [x] 1.1 In `lambda-fns/controllers/waves/addPhoto.ts`, replace the unconditional `_assertNotFrozen(wave)` call with a role-based check: allow owners through, apply freeze restriction only for non-owners (follow pattern from `removePhoto.ts` lines 32-45)

## 2. Allow owner to update frozen waves freely

- [x] 2.1 In `lambda-fns/controllers/waves/update.ts`, remove the `_isWaveDateFrozen(currentWave)` check and its associated "only freezeDate allowed" restriction (lines 49-61 in current file), since only owners can reach this code path
- [x] 2.2 Remove unused imports: `_isWaveDateFrozen` import and `currentWave` variable assignment

## 3. Allow owner to merge frozen waves

- [x] 3.1 In `lambda-fns/controllers/waves/mergeWaves.ts`, remove the two `_assertNotDateFrozen()` calls (lines 34, 39) since both waves must be owned by the same user
- [x] 3.2 Remove unused import: `_assertNotDateFrozen`

## 4. Verify changes compile cleanly

- [x] 4.1 Run TypeScript type checking to confirm no errors from removed imports or changed logic
- [-] 4.2 Confirm lint passes on all three modified files (lint tooling incompatible with ESLint 9 flat config; TS compilation verified clean)
