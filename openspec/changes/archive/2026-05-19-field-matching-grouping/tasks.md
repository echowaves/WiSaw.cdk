## 1. Database Migration

- [x] 1.1 Create migration to rename `Waves.granularity` → `Waves.groupingLevel` (preserve existing values, add down function)

## 2. GraphQL Schema

- [x] 2.1 Rename `Granularity` enum to `GroupingLevel` in `graphql/schema.graphql` (values: DISTRICT, CITY, REGION, COUNTRY)
- [x] 2.2 Rename `granularity` parameter to `groupingLevel` in `createWave` mutation
- [x] 2.3 Rename `granularity` parameter to `groupingLevel` in `updateWave` mutation
- [x] 2.4 Rename `granularity` parameter to `groupingLevel` in `autoGroupPhotosIntoWaves` mutation

## 3. Resolver Configuration

- [x] 3.1 Update `lambda-fns/index.ts`: change all `args.granularity` → `args.groupingLevel` in getArgs functions (createWave, updateWave, autoGroupPhotosIntoWaves)

## 4. Wave Controller Updates

- [x] 4.1 Update `lambda-fns/controllers/waves/create.ts`: rename `granularity` parameter → `groupingLevel`, update SQL column references
- [x] 4.2 Update `lambda-fns/controllers/waves/update.ts`: rename `granularity` parameter → `groupingLevel`, update SQL column references
- [x] 4.3 Update `lambda-fns/models/wave.ts`: rename `granularity` field → `groupingLevel` in interface

## 5. Auto-Grouping Logic Rewrite

- [x] 5.1 Add `computeGroupingKey(photo, groupingLevel)` function that returns the appropriate locality fields based on grouping level
- [x] 5.2 Add `computeWaveNameFromKey(anchorGeo, groupingLevel)` function for wave naming (extract locality name based on grouping level)
- [x] 5.3 Rewrite `autoGroupPhotosIntoWaves` main function: replace distance-based grouping with field-matching using `computeGroupingKey`
- [x] 5.4 Remove `haversineDistance` function (no longer needed)
- [x] 5.5 Remove `computeClusterRadius` function (no longer needed)
- [x] 5.6 Remove `GRANULARITY_FALLBACKS` constant (no longer needed)
- [x] 5.7 Update `createWaveAndAssign` to use `groupingLevel` column name, default `radius` to 50
- [x] 5.8 Update `getLocalityKey` → rename to `getLocalityNameForWave` and simplify (only extracts name for wave naming, not matching)
- [x] 5.9 Update `getLocalityName` → remove or simplify (only used for wave naming)

## 6. Testing Verification

- [ ] 6.1 Verify existing waves retain their groupingLevel value after migration
- [ ] 6.2 Verify auto-grouping groups photos by field match (same city, different distances)
- [ ] 6.3 Verify auto-grouping separates photos by different fields at each grouping level
- [ ] 6.4 Verify wave naming still works with new grouping logic
- [ ] 6.5 Verify default groupingLevel (CITY) works when parameter omitted
