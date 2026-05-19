# Spec: Photo District Field

## Purpose

Define the separate `district` field storage and retrieval for photo locality data, enabling correct DISTRICT-level grouping.

## Requirements

### Requirement: Photo District Field

The Photo type MUST have a separate `district` field in addition to `locality`:
- `district: String` — district/area name from reverse geocoding (separate from locality)
- `locality: String` — city/town name from reverse geocoding

Both fields are nullable and stored independently in the database.

#### Scenario: Photo creation stores district separately
- **GIVEN** a photo at valid coordinates with both Locality and District in reverse geocode result
- **WHEN** the photo is created
- **THEN** both `locality` and `district` fields are populated from their respective address fields

#### Scenario: Photo creation with only locality
- **GIVEN** a photo where reverse geocode returns Locality but no District
- **WHEN** the photo is created
- **THEN** `locality` is populated and `district` is null

#### Scenario: Photo creation with only district
- **GIVEN** a photo where reverse geocode returns District but no Locality
- **WHEN** the photo is created
- **THEN** `district` is populated and `locality` is null (or vice versa based on fallback logic)

#### Scenario: GraphQL query returns district
- **GIVEN** a photo with populated district field
- **WHEN** a client queries the photo
- **THEN** the `district` field is included in the response

### Requirement: District Database Column

The Photos table MUST have a `district` STRING NULL column:
- `district` STRING NULL
- Stored separately from `locality` column
- Allows NULL for photos without district data

#### Scenario: Migration adds district column
- **WHEN** the migration runs
- **THEN** `district` column is added to Photos table as STRING NULL
- **AND** existing rows have NULL for district (until backfill)

#### Scenario: Backfill populates district
- **GIVEN** existing photos without district data
- **WHEN** the backfill migration runs
- **THEN** district is populated from reverse geocode for each photo
- **AND** photos with failed geocodes have null district

### Requirement: District in Auto-Grouping

The auto-grouping algorithm MUST use the `district` field from the database (not from reverse geocode API calls):
- `computeGroupingKey` for DISTRICT level uses `photo.district` from database
- `computeWaveNameFromKey` for DISTRICT level uses `geo.district` from database
- No reverse geocode API calls are made during auto-grouping

#### Scenario: DISTRICT grouping uses database district
- **GIVEN** photos with different district values in database
- **WHEN** auto-group runs with groupingLevel: DISTRICT
- **THEN** photos are grouped by matching `district` field values

#### Scenario: DISTRICT grouping produces different results than CITY
- **GIVEN** photos in same city but different districts
- **WHEN** auto-group runs with groupingLevel: DISTRICT
- **THEN** photos are separated into different groups (unlike CITY grouping)

#### Scenario: No reverse geocode calls during auto-grouping
- **GIVEN** 100 photos needing auto-grouping
- **WHEN** auto-group runs
- **THEN** zero reverse geocode API calls are made
- **AND** all locality data is read from database columns
