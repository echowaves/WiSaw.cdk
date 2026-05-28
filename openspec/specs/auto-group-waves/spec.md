# Spec: Auto-group Waves

## Purpose

Define the active wave model for auto-grouping photos, where each user has exactly one active wave at a time, and photos are assigned chronologically based on field-matching against the active wave's anchor fields and grouping level.

## Requirements

### Requirement: Active Wave Model

Each user SHALL have exactly one active wave at a time, tracked by an `isActive` boolean on the Wave entity. When a new wave is created (either manually or via auto-group), the user's previous active wave MUST be deactivated (`isActive=false`).

#### Scenario: First wave is active

- **WHEN** a user creates their first wave
- **THEN** that wave has `isActive=true`

#### Scenario: Second wave deactivates the first

- **GIVEN** a user with an active wave (`isActive=true`)
- **WHEN** a second wave is created
- **THEN** the first wave's `isActive` is set to `false`
- **AND** the second wave has `isActive=true`

#### Scenario: Only one active wave per user

- **WHEN** querying a user's waves
- **THEN** at most one wave has `isActive=true`

### Requirement: Wave Anchor Fields

Each Wave MUST store anchor fields that define its geographic scope: `anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`. These fields are populated from the first photo (anchor photo) added to the wave.

#### Scenario: Anchor fields set on wave creation

- **GIVEN** a wave created with a photo at "Manhattan, New York, United States"
- **WHEN** the wave is created
- **THEN** `anchorLocality="Manhattan"`, `anchorRegion="New York"`, `anchorCountry="United States"`, `anchorDistrict=null`

#### Scenario: Anchor fields from DISTRICT-level photo

- **GIVEN** a wave created with a photo at "SoHo, Manhattan, New York, United States"
- **WHEN** the wave is created with `groupingLevel=DISTRICT`
- **THEN** `anchorDistrict="SoHo"`, `anchorLocality="Manhattan"`, `anchorRegion="New York"`, `anchorCountry="United States"`

### Requirement: groupingLevel Stored on Wave

Each Wave MUST store the `groupingLevel` (DISTRICT, CITY, REGION, or COUNTRY) used when it was created. This value is used for:
1. Comparing incoming photos against the wave's scope
2. Detecting when the user changes grouping level (triggers new wave creation)

#### Scenario: groupingLevel stored on wave creation

- **GIVEN** `autoGroupPhotosIntoWaves` called with `groupingLevel: CITY`
- **WHEN** a new wave is created
- **THEN** the wave's `groupingLevel` is set to `CITY`

#### Scenario: groupingLevel change triggers new wave

- **GIVEN** a user with an active wave at `groupingLevel: CITY`
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: REGION`
- **THEN** a new wave is created with `groupingLevel: REGION`
- **AND** the old CITY wave is deactivated

### Requirement: Photo Upload Does Not Assign to Wave

The `createPhoto` mutation MUST NOT add photos to any wave. Photos are stored with their geocode fields (locality, district, region, country, countryCode) but remain "ungrouped" (not present in WavePhotos table) until `autoGroupPhotosIntoWaves` is invoked.

#### Scenario: Photo upload does not create wave

- **WHEN** `createPhoto(uuid, lat, lon)` is called
- **THEN** the photo is stored with geocode fields
- **AND** no wave is created
- **AND** the photo is not added to WavePhotos

#### Scenario: localityLevel removed from photo creation

- **WHEN** `createPhoto` mutation is called
- **THEN** it does NOT accept a `localityLevel` parameter
- **AND** the Photo type does NOT have a `localityLevel` field

### Requirement: Auto-group Processes All Ungrouped Photos Chronologically

The `autoGroupPhotosIntoWaves` mutation MUST process ALL ungrouped active photos in a single call, ordered by `createdAt` ascending. For each photo:

1. If no active wave exists → create new wave with `createdAt` and `updatedAt` set to the photo's `createdAt`, and `freezeDate` set to the photo's `createdAt`
2. If the passed `groupingLevel` differs from the active wave's stored `groupingLevel` → create new wave (same timestamp rules)
3. If the photo doesn't fit the active wave based on field matching → create new wave (same timestamp rules)
4. Otherwise → add photo to active wave; `_updatePhotosCount` SHALL recalculate `updatedAt = MAX(photo.createdAt)` and `freezeDate = MAX(photo.createdAt)` from the wave's photos

Wave `splashDate` SHALL continue to use season-start boundaries (unchanged).

#### Scenario: Auto-group processes multiple photos

- **GIVEN** 50 ungrouped photos in chronological order
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel: CITY)` is called
- **THEN** all 50 photos are processed in the single call
- **AND** photos are distributed across one or more waves based on field matching

#### Scenario: Wave createdAt derives from first photo

- **GIVEN** a user with ungrouped photos, the earliest having `createdAt = "2025-07-01 10:00:00"`
- **WHEN** `autoGroupPhotosIntoWaves` creates a new wave starting with that photo
- **THEN** the wave's `createdAt` SHALL equal `"2025-07-01 10:00:00"`
- **AND** the wave's `updatedAt` SHALL equal `"2025-07-01 10:00:00"`

#### Scenario: Wave updatedAt derives from last photo

- **GIVEN** a wave with photos having `createdAt` values from July 1 through July 15
- **WHEN** `_updatePhotosCount` runs after photos are flushed
- **THEN** the wave's `updatedAt` SHALL equal the `MAX(photo.createdAt)` across all photos in the wave
- **AND** the wave's `freezeDate` SHALL equal the same `MAX(photo.createdAt)`

#### Scenario: Multiple waves get distinct timestamps

- **GIVEN** 100 ungrouped photos spanning two cities, with different photo dates per city
- **WHEN** `autoGroupPhotosIntoWaves` processes them in one batch
- **THEN** each resulting wave SHALL have a distinct `createdAt` derived from its first photo
- **AND** each wave SHALL have a distinct `updatedAt` derived from its last photo

#### Scenario: Photo drift creates new wave

- **GIVEN** an active wave with `anchorLocality="Manhattan"`, `groupingLevel=CITY`
- **WHEN** processing a photo with `locality="Brooklyn"` and `createdAt="2025-07-10 14:00:00"`
- **THEN** a new wave is created with `anchorLocality="Brooklyn"`
- **AND** the new wave's `createdAt` SHALL equal `"2025-07-10 14:00:00"`
- **AND** the Manhattan wave is deactivated

#### Scenario: Wave name refinement does not override updatedAt

- **GIVEN** a wave whose `updatedAt` was set to `MAX(photo.createdAt)` by `_updatePhotosCount`
- **WHEN** `closeWave` runs and updates the wave name and anchor fields
- **THEN** the wave's `updatedAt` SHALL remain at the photo-derived value
- **AND** the UPDATE query in `closeWave` SHALL NOT set `updatedAt`

#### Scenario: No ungrouped photos

- **WHEN** `autoGroupPhotosIntoWaves` is called and no ungrouped photos exist
- **THEN** result has `photosGrouped=0`, `photosRemaining=0`, `hasMore=false`

#### Scenario: Grouping level change creates new wave

- **GIVEN** an active wave with `groupingLevel=CITY`
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel=REGION`
- **THEN** a new wave is created with `groupingLevel=REGION`
- **AND** the CITY wave is deactivated
- **AND** all ungrouped photos are processed against the new REGION wave

#### Scenario: Incremental auto-grouping across batches preserves timestamps

- **GIVEN** a wave created in a previous auto-group batch with `updatedAt = "2025-07-10"`
- **WHEN** a new batch adds more photos with `createdAt` up to `"2025-07-15"`
- **THEN** `_updatePhotosCount` SHALL update `updatedAt = "2025-07-15"` and `freezeDate = "2025-07-15"`

### Requirement: Field-Based Photo Fitting

A photo fits into a wave based on the wave's stored `groupingLevel`. The following fields must match:

| GroupingLevel | Fields Required to Match |
|---------------|--------------------------|
| DISTRICT       | district + locality + region + country |
| CITY           | locality + region + country |
| REGION         | region + country |
| COUNTRY        | country |

#### Scenario: Photo fits CITY-level wave

- **GIVEN** active wave with `anchorLocality="Manhattan"`, `anchorRegion="New York"`, `anchorCountry="USA"`, `groupingLevel=CITY`
- **WHEN** processing a photo with `locality="Manhattan"`, `region="New York"`, `country="USA"`
- **THEN** the photo fits the wave and is added to it

#### Scenario: Photo drifts from CITY-level wave

- **GIVEN** active wave with `anchorLocality="Manhattan"`, `groupingLevel=CITY`
- **WHEN** processing a photo with `locality="Brooklyn"`
- **THEN** the photo does NOT fit
- **AND** a new wave is created

#### Scenario: Photo fits REGION-level wave

- **GIVEN** active wave with `anchorRegion="New York"`, `anchorCountry="USA"`, `groupingLevel=REGION`
- **WHEN** processing a photo with `locality="Manhattan"`, `region="New York"`, `country="USA"`
- **THEN** the photo fits (locality doesn't matter at REGION level)

#### Scenario: Photo fits COUNTRY-level wave

- **GIVEN** active wave with `anchorCountry="USA"`, `groupingLevel=COUNTRY`
- **WHEN** processing a photo with `locality="Boston"`, `region="Massachusetts"`, `country="USA"`
- **THEN** the photo fits (only country matters)

### Requirement: AutoGroupResult Includes isNewWave

The `AutoGroupResult` type MUST include an `isNewWave` boolean indicating whether the last processed photo triggered creation of a new wave.

#### Scenario: Last photo added to existing wave

- **GIVEN** auto-group processes photos, all fit the active wave
- **WHEN** processing completes
- **THEN** `isNewWave=false`

#### Scenario: Last photo created new wave

- **GIVEN** auto-group processes photos, the last photo drifts from the active wave
- **WHEN** processing completes
- **THEN** `isNewWave=true`
- **AND** `waveUuid` is the ID of the newly created wave

### Requirement: Wave Name Uses Anchor Fields

Wave name follows `<AnchorName>, <DateRange>` format. The anchor name is determined by the wave's `groupingLevel`:

- `DISTRICT` → uses `anchorDistrict` (fallback to `anchorLocality`)
- `CITY` → uses `anchorLocality`
- `REGION` → uses `anchorRegion`
- `COUNTRY` → uses `anchorCountry`

#### Scenario: Wave name at CITY level

- **GIVEN** a wave with `anchorLocality="Manhattan"`, `groupingLevel=CITY`
- **WHEN** the wave is named
- **THEN** name is "Manhattan, Jan – Mar 2026"

#### Scenario: Wave name fallback to coordinates

- **GIVEN** a wave with null anchor fields
- **WHEN** the wave is named
- **THEN** name uses coordinates format: "40.7°N, 74.0°W, Jan 2026"

### Requirement: localityLevel Removed from Photo Schema

The `localityLevel` field MUST be removed from:
- Photo GraphQL type
- `createPhoto` mutation parameters
- Photo TypeScript model
- Photos database table

#### Scenario: Photo type has no localityLevel

- **WHEN** querying the GraphQL schema
- **THEN** the Photo type does NOT include `localityLevel`

#### Scenario: createPhoto has no localityLevel parameter

- **WHEN** calling `createPhoto(uuid, lat, lon, video)`
- **THEN** the mutation does NOT accept `localityLevel`

#### Scenario: Photos table has no locality_level column

- **WHEN** querying the database schema
- **THEN** the Photos table does NOT have a `locality_level` column

### Requirement: Wave Has isActive and Anchor Columns

The Waves table MUST include the following new columns:
- `anchorLocality` VARCHAR (nullable)
- `anchorDistrict` VARCHAR (nullable)
- `anchorRegion` VARCHAR (nullable)
- `anchorCountry` VARCHAR (nullable)
- `isActive` BOOLEAN DEFAULT true

#### Scenario: Wave table has anchor columns

- **WHEN** querying the database schema
- **THEN** the Waves table includes all anchor columns

#### Scenario: Wave table has isActive column

- **WHEN** querying the database schema
- **THEN** the Waves table includes `isActive` column with default true

### Requirement: AutoGroupResult Includes wavesCreated

The `AutoGroupResult` type MUST include a `wavesCreated: Int!` field reporting the total number of new waves created during the auto-grouping operation.

#### Scenario: No waves created (all photos fit existing wave)

- **GIVEN** a user with an active wave and ungrouped photos that all fit
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` is called
- **THEN** `wavesCreated=0`

#### Scenario: One new wave created

- **GIVEN** a user with an active wave and one photo that drifts geographically
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` is called
- **THEN** `wavesCreated=1`

#### Scenario: Multiple waves created in batch

- **GIVEN** 50 ungrouped photos spanning multiple geographic areas
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` is called
- **THEN** `wavesCreated=N` where N equals the number of new waves created during processing
