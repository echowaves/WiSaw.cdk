## 1. Database Migration

- [ ] 1.1 Create migration file `migrations/20260408120000-wave-date-lifecycle.js` that backfills NULL `startDate` values (waves with photos → MIN(Photos.createdAt) via WavePhotos, waves without photos → Waves.createdAt), backfills NULL `endDate` values (waves with photos → MAX(Photos.createdAt), waves without photos → Waves.createdAt + 1 month), ensures `frozen=true` waves have `endDate` in the past (set to MAX(Photos.createdAt) or Waves.createdAt), renames `startDate` → `splashDate`, renames `endDate` → `freezeDate`, adds NOT NULL constraints to both columns, and drops the `frozen` column

## 2. GraphQL Schema

- [ ] 2.1 Update `graphql/schema.graphql` Wave type: rename `startDate` → `splashDate`, rename `endDate` → `freezeDate`, remove `frozen: Boolean!`, remove `isActive: Boolean!`
- [ ] 2.2 Update `graphql/schema.graphql` updateWave mutation: rename `startDate` → `splashDate`, rename `endDate` → `freezeDate`, remove `frozen: Boolean` parameter
- [ ] 2.3 Update `graphql/schema.graphql` createWave mutation: add optional `splashDate: AWSDateTime` and `freezeDate: AWSDateTime` parameters

## 3. Wave Model

- [ ] 3.1 Update `lambda-fns/models/wave.ts`: rename `startDate` → `splashDate`, rename `endDate` → `freezeDate`, remove `frozen` field, remove `isActive` field

## 4. Helper Functions

- [ ] 4.1 Update `lambda-fns/controllers/waves/_isWaveFrozen.ts`: change signature to accept `{ splashDate, freezeDate }`, return true when `NOW() < splashDate OR NOW() > freezeDate`
- [ ] 4.2 Update `lambda-fns/controllers/waves/_assertNotFrozen.ts`: update type signature from `{ frozen, endDate }` to `{ splashDate, freezeDate }`
- [ ] 4.3 Delete `lambda-fns/controllers/waves/_isWaveActive.ts`
- [ ] 4.4 Update `lambda-fns/controllers/waves/_isPhotoInFrozenWave.ts`: replace SQL referencing `w."frozen"` and `w."endDate"` with `w."splashDate"` and `w."freezeDate"`

## 5. Controllers

- [ ] 5.1 Update `lambda-fns/controllers/waves/create.ts`: add optional `splashDate` and `freezeDate` parameters, default `splashDate = NOW()` and `freezeDate = NOW() + 30 days`, validate freezeDate > splashDate, include both columns in INSERT query
- [ ] 5.2 Update `lambda-fns/controllers/waves/update.ts`: remove `frozen` parameter, rename `startDate` → `splashDate` and `endDate` → `freezeDate`, update freeze-check SELECT to use `"splashDate"` and `"freezeDate"`, update frozen-state guard to only allow `freezeDate` changes when frozen, update SET clauses for new column names
- [ ] 5.3 Update `lambda-fns/controllers/waves/addPhoto.ts`: update SELECT to use `"splashDate"` and `"freezeDate"` instead of `"frozen"`, `"startDate"`, `"endDate"`, remove `_isWaveActive` import and check (covered by `_assertNotFrozen`), update source-wave frozen check SELECT
- [ ] 5.4 Update `lambda-fns/controllers/waves/removePhoto.ts`: update SELECT to use `"splashDate"` and `"freezeDate"` instead of `"frozen"`, `"endDate"`
- [ ] 5.5 Update `lambda-fns/controllers/waves/listWaves.ts`: remove `_isWaveActive` import, remove `wave.isActive` computation, keep `wave.isFrozen = _isWaveFrozen(row)` with updated signature
- [ ] 5.6 Update `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`: replace `frozen = true` with `splashDate = MIN(photo.createdAt)` and `freezeDate = MAX(photo.createdAt)` in the INSERT query

## 6. Resolver / Index

- [ ] 6.1 Update `lambda-fns/index.ts`: rename `startDate` → `splashDate`, `endDate` → `freezeDate` in updateWave args, remove `frozen` arg, add `splashDate` and `freezeDate` args for createWave
- [ ] 6.2 Check `lib/resources/resolvers.ts` for any wave field mappings that need updating
