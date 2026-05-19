## 1. Database Migrations

- [x] 1.1 Create migration to DROP COLUMN locality_level FROM Photos table
- [x] 1.2 Create migration to ADD anchor columns (anchorLocality, anchorDistrict, anchorRegion, anchorCountry) TO Waves table
- [x] 1.3 Create migration to ADD isActive BOOLEAN DEFAULT true TO Waves table
- [x] 1.4 Create migration to backfill anchor columns from existing wave data (first photo's geocode fields per wave)
- [x] 1.5 Create migration to mark oldest wave per user as isActive=true, all others as isActive=false

## 2. GraphQL Schema Updates

- [x] 2.1 Remove localityLevel from Photo type in schema.graphql
- [x] 2.2 Remove localityLevel parameter from createPhoto mutation in schema.graphql
- [x] 2.3 Add anchor fields (anchorLocality, anchorDistrict, anchorRegion, anchorCountry) to Wave type in schema.graphql
- [x] 2.4 Add isActive to Wave type in schema.graphql
- [x] 2.5 Add isNewWave to AutoGroupResult type in schema.graphql
- [x] 2.6 Make groupingLevel required on autoGroupPhotosIntoWaves mutation in schema.graphql

## 3. Model Updates

- [x] 3.1 Remove localityLevel from Photo model (lambda-fns/models/photo.ts)
- [x] 3.2 Add anchor fields and isActive to Wave model (lambda-fns/models/wave.ts)

## 4. Photo Creation Controller Updates

- [x] 4.1 Remove localityLevel parameter from createPhoto controller (lambda-fns/controllers/photos/create.ts)
- [x] 4.2 Remove localityLevel from INSERT statement in createPhoto controller
- [x] 4.3 Remove localityLevel from geocode result handling in createPhoto controller

## 5. Auto-group Controller Rewrite

- [x] 5.1 Add fitsPhotoInWave helper function (field-based comparison using wave's groupingLevel and anchor fields)
- [x] 5.2 Rewrite main function to fetch active wave (isActive=true, ORDER BY createdAt DESC LIMIT 1)
- [x] 5.3 Rewrite main function to fetch ALL ungrouped photos (ORDER BY createdAt ASC, no LIMIT)
- [x] 5.4 Implement chronological photo processing loop:
   - Check if groupingLevel changed → create new wave
   - Check if photo fits active wave → add or create new wave
   - Deactivate old wave when new one created
- [x] 5.5 Update return value to include isNewWave flag
- [x] 5.6 Update return value to reflect all photos processed (photosRemaining=0, hasMore=false)

## 6. Wave Controller Updates

- [x] 6.1 Update getWave controller to include anchor fields in query and response
- [x] 6.2 Update createWave controller to accept and store anchor fields
- [x] 6.3 Update updateWave controller to handle anchor field updates

<!-- NOTE: ../Wisaw.cdk resolves to the same directory as the current workspace (/Users/dmitry/hacks/wisaw/WiSaw.cdk).
     All changes are applied in-place. No sync step needed. -->

## 7. Sync to Backend Workspace (../Wisaw.cdk)

- [x] 7.1 Apply all schema changes to ../Wisaw.cdk/graphql/schema.graphql (applied in-place)
- [x] 7.2 Apply all model changes to ../Wisaw.cdk/lambda-fns/models/ (applied in-place)
- [x] 7.3 Apply all controller changes to ../Wisaw.cdk/lambda-fns/controllers/ (applied in-place)
- [x] 7.4 Apply all database migrations to ../Wisaw.cdk/migrations/ (applied in-place)
