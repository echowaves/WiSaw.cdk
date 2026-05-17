# Tasks: semantic-photo-locality

## Group 1: Database Migrations

### Task 1.1: Migration to add locality columns
- [x] Create `migrations/20260514000000-add-photo-locality.js`
- [x] Add 5 nullable STRING columns to Photos table:
   - `locality`, `localityLevel`, `region`, `country`, `countryCode`
- [x] Follow existing migration patterns in the project

### Task 1.2: Migration to populate locality for existing photos
- [x] Create `migrations/20260514000001-populate-photo-locality.js`
- [x] Batch reverse geocode 1000 photos per invocation
- [x] Use hasMore flag for pagination
- [x] Failed geocodes → store null
- [x] Import `@aws-sdk/client-geo-places` in migration

## Group 2: GraphQL Schema

### Task 2.1: Add GranularityEnum to schema
- [x] Add `enum Granularity { DISTRICT, CITY, REGION, COUNTRY }` to `graphql/schema.graphql`

### Task 2.2: Add locality fields to Photo type
- [x] Add `locality: String` to Photo type
- [x] Add `localityLevel: String` to Photo type
- [x] Add `region: String` to Photo type
- [x] Add `country: String` to Photo type
- [x] Add `countryCode: String` to Photo type

### Task 2.3: Replace radius with granularity on autoGroupPhotosIntoWaves
- [x] Change `radius: Int` → `granularity: Granularity` in `autoGroupPhotosIntoWaves` mutation

### Task 2.4: Replace radius with granularity on createWave
- [x] Change `radius: Int` → `granularity: Granularity` in `createWave` mutation

### Task 2.5: Replace radius with granularity on updateWave
- [x] Change `radius: Int` → `granularity: Granularity` in `updateWave` mutation

## Group 3: Model Updates

### Task 3.1: Add locality fields to Photo model
- [x] Add `locality: string | null` to Photo model
- [x] Add `localityLevel: string | null` to Photo model
- [x] Add `region: string | null` to Photo model
- [x] Add `country: string | null` to Photo model
- [x] Add `countryCode: string | null` to Photo model

### Task 3.2: Add granularity to Wave model
- [x] Add `granularity: string | null` to Wave model

## Group 4: Reverse Geocode Refactor

### Task 4.1: Refactor reverseGeocode in autoGroupPhotosIntoWaves
- [x] Change return type from `string | null` to `ReverseGeocodeResult | null`
- [x] Return structured object: `{ locality, localityLevel, region, country, countryCode }`
- [x] Map from AWS Geo Places Address object per REQ-3

### Task 4.2: Add GRANULARITY_FALLBACKS constant
- [x] Add `GRANULARITY_FALLBACKS: Record<string, number>` with DISTRICT=10, CITY=50, REGION=250, COUNTRY=1000
- [x] Add `DEFAULT_GRANULARITY = 'CITY'`

### Task 4.3: Add locality helper functions
- [x] Add `getLocalityKey(granularity, geo)` — extracts correct field based on granularity
- [x] Add `getLocalityName(granularity, geo)` — extracts display name with fallback

## Group 5: Photo Creation Updates

### Task 5.1: Add reverse geocode to photo creation
- [x] Import `@aws-sdk/client-geo-places` in `controllers/photos/create.ts`
- [x] Add inline `reverseGeocode()` function
- [x] On success: return structured address fields
- [x] On failure: return empty strings (not null)

### Task 5.2: Update INSERT query in photo creation
- [x] Add 5 locality columns to INSERT statement
- [x] Pass geocode result values as parameters

### Task 5.3: Add ReverseGeocodeResult interface
- [x] Define interface matching reverseGeocode return type

## Group 6: Auto-group Controller Updates

### Task 6.1: Update main function signature
- [x] Change `main(uuid, radius?: number)` → `main(uuid, granularity?: string)`

### Task 6.2: Update photo grouping threshold
- [x] Replace `radius ?? 100` with `GRANULARITY_FALLBACKS[granularity ?? DEFAULT_GRANULARITY]`

### Task 6.3: Update wave name generation
- [x] Replace `reverseGeocode()` string result with structured result
- [x] Use `getLocalityName()` to extract wave name from geocode result

### Task 6.4: Update createWaveAndAssign signature
- [x] Add `granularity: string` parameter
- [x] Write granularity to INSERT query

### Task 6.5: Add per-invocation locality cache
- [x] Add `const localityCache = new Map<string, ReverseGeocodeResult>()`
- [x] Check cache before calling reverseGeocode
- [x] Store result in cache after successful geocode

### Task 6.6: Update all createWaveAndAssign calls
- [x] Pass granularity parameter in all call sites

### Task 6.7: Verify computeClusterRadius unchanged
- [x] Confirm `computeClusterRadius()` function is not modified

### Task 6.8: Verify locationless photo handling unchanged
- [x] Confirm locationless photos still included in every wave

## Group 7: Resolver Wiring

### Task 7.1: Update autoGroupPhotosIntoWaves resolver
- [x] Change `getArgs` from `[args.uuid, args.radius]` → `[args.uuid, args.granularity]`

### Task 7.2: Update createWave resolver
- [x] Add `args.granularity` to getArgs array

### Task 7.3: Update updateWave resolver
- [x] Add `args.granularity` to getArgs array

## Group 8: Wave Controller Updates

### Task 8.1: Update createWave controller signature
- [x] Add `granularity?: string` parameter after `radius?: number`
- [x] Write granularity to INSERT query (default: 'CITY')

### Task 8.2: Update updateWave controller
- [x] Add `granularity?: string` parameter
- [x] Add granularity to SET clause
- [x] Add granularity to freeze check

### Task 8.3: Verify wave radius unchanged
- [x] Confirm wave's stored radius field is still computed/set separately
