## 1. Add isNewWave to GraphQL schema

- [ ] 1.1 Add `isNewWave: Boolean!` to `AutoGroupResult` type in `graphql/schema.graphql`

## 2. Add isNewWave to AutoGroupResult interface

- [ ] 2.1 Add `isNewWave: boolean` to `AutoGroupResult` interface in `autoGroupPhotosIntoWaves.ts`

## 3. Simplify assignPhotosToNearestWave

- [ ] 3.1 Change return type back to `Promise<number>` — remove primaryWaveUuid/primaryWaveName tracking

## 4. Unify temporal splitting

- [ ] 4.1 Make `splitByTemporalGaps` generic — accept `{ id: string, createdAt: string }[]` and return grouped arrays
- [ ] 4.2 Remove `splitUngroupedByTemporalGaps` and `UngroupedPhoto` interface

## 5. Inline handleUnresolvablePhotos into main

- [ ] 5.1 Move locationless photo query + absorb-or-create logic into `main()` after the located-photos path
- [ ] 5.2 Remove `handleUnresolvablePhotos` function

## 6. Set isNewWave on all return paths

- [ ] 6.1 Create paths → `isNewWave: true`
- [ ] 6.2 Absorb paths → `isNewWave: false`
- [ ] 6.3 Nothing-to-process → `isNewWave: false`

## 7. Verify

- [ ] 7.1 Verify all return paths set `isNewWave` correctly
- [ ] 7.2 Verify no duplicate logic between located and locationless flows
