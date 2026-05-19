## 1. Database Migration — Add District Column

- [x] 1.1 Create migration file `migrations/YYYYMMDDHHMMSS-add-photo-district.js` to add `district` column to Photos table
- [x] 1.2 Migration adds `district STRING NULL` column using `ALTER TABLE ... ADD COLUMN`
- [x] 1.3 Migration down reverses the column addition

## 2. Database Backfill — Populate District for Existing Photos

- [x] 2.1 Create backfill migration file `migrations/YYYYMMDDHHMMSS-backfill-photo-district.js`
- [x] 2.2 Backfill queries photos in batches of 1000 where `district IS NULL` AND `lat IS NOT NULL` AND `lon IS NOT NULL`
- [x] 2.3 For each photo, calls reverse geocode API and stores `Address.District ?? null` in `district` column
- [x] 2.4 Backfill uses `hasMore` flag for pagination across invocations
- [x] 2.5 Photos with failed geocodes or null lat/lon are skipped (district remains null)

## 3. GraphQL Schema — Expose District Field

- [x] 3.1 Add `district: String` field to Photo type in `graphql/schema.graphql`
- [x] 3.2 Field is nullable (String, not String!)
- [x] 3.3 Field is placed after `locality` field for logical grouping

## 4. Photo Creation — Store District Separately

- [x] 4.1 Update `lambda-fns/controllers/photos/create.ts` reverse geocode result mapping
- [x] 4.2 Change `locality: addr.Locality ?? addr.District` to `locality: addr.Locality ?? null`
- [x] 4.3 Add `district: addr.District ?? null` to the photo creation data
- [x] 4.4 `localityLevel` logic unchanged (derived from whether Locality is present)

## 5. TypeScript Interfaces — Add District Field

- [x] 5.1 Add `district?: string | null` to Photo interface in `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`
- [x] 5.2 Add `district?: string | null` to ReverseGeocodeResult interface in `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`
- [x] 5.3 Add `district?: string | null` to Photo interface in `lambda-fns/controllers/photos/create.ts`

## 6. Auto-Grouping — Read District from Database

- [x] 6.1 Update `autoGroupPhotosIntoWaves` main function to read `district` from photo database row
- [x] 6.2 Replace the geo construction block (lines 274-282) to include `district: photo.district`
- [x] 6.3 Remove the reverse geocode call from the auto-grouping loop (the `reverseGeocode` function call and its surrounding logic)
- [x] 6.4 Remove the locality cache (no longer needed without API calls)
- [x] 6.5 Verify `computeGroupingKey` works with district from database
- [x] 6.6 Verify `computeWaveNameFromKey` uses `geo.district` for DISTRICT grouping

## 7. Cleanup — Remove Unused Code

- [x] 7.1 Remove `reverseGeocode` function from `autoGroupPhotosIntoWaves.ts` (no longer called)
- [x] 7.2 Remove `@aws-sdk/client-geo-places` import from `autoGroupPhotosIntoWaves.ts` (no longer needed)
- [x] 7.3 Verify no other functions in `autoGroupPhotosIntoWaves.ts` call reverse geocode

## 8. Testing — Verify Implementation

- [x] 8.1 Verify migration adds column successfully (check `psql` or Sequelize describe)
- [x] 8.2 Verify photo creation stores district separately from locality
- [x] 8.3 Verify GraphQL query returns district field on Photo type
- [x] 8.4 Verify DISTRICT grouping produces different results than CITY grouping (test with photos in different districts)
- [x] 8.5 Verify auto-grouping does NOT call reverse geocode API (check CloudWatch logs)
- [x] 8.6 Verify wave naming uses district for DISTRICT grouping level
- [x] 8.7 Verify backfill migration processes photos in batches
- [x] 8.8 Verify existing waves are not affected by migration
