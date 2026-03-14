## 1. Add isNewWave to GraphQL schema

- [x] 1.1 Add `isNewWave: Boolean!` to `AutoGroupResult` type in `graphql/schema.graphql`

## 2. Add isNewWave to AutoGroupResult interface

- [x] 2.1 Add `isNewWave: boolean` to `AutoGroupResult` interface in `autoGroupPhotosIntoWaves.ts`

## 3. Simplify assignPhotosToNearestWave

- [x] 3.1 Change return type back to `Promise<number>` — remove primaryWaveUuid/primaryWaveName tracking

## 4. Unify temporal splitting

- [x] 4.1 Make `splitByTemporalGaps` generic — accept `{ id: string, createdAt: string }[]` and return grouped arrays
- [x] 4.2 Remove `splitUngroupedByTemporalGaps` and `UngroupedPhoto` interface

## 5. Inline handleUnresolvablePhotos into main

- [x] 5.1 Move locationless photo query + absorb-or-create logic into `main()` after the located-photos path
- [x] 5.2 Remove `handleUnresolvablePhotos` function

## 6. Set isNewWave on all return paths

- [x] 6.1 Create paths → `isNewWave: true`
- [x] 6.2 Absorb paths → `isNewWave: false`
- [x] 6.3 Nothing-to-process → `isNewWave: false`

## 7. Verify

- [x] 7.1 Verify all return paths set `isNewWave` correctly
- [x] 7.2 Verify no duplicate logic between located and locationless flows
