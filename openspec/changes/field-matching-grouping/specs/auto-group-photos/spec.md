# Spec: Auto-group Photos

## Purpose

Define how photos are grouped into waves using field-matching based on reverse geocoding locality data, not distance thresholds.

## MODIFIED Requirements

### Requirement: GroupingLevel Enum

A `GroupingLevel` enum MUST be available in the GraphQL schema with values:

- `DISTRICT` — neighborhood/borough level (all locality fields must match)
- `CITY` — city/town level (locality + region + country must match)
- `REGION` — state/province level (region + country must match)
- `COUNTRY` — country level (country only must match)

### Requirement: Mutation Parameter Rename

The following mutations MUST accept `groupingLevel: GroupingLevel` instead of `granularity: Granularity`:

- `createWave(name:!, description:!, uuid:!, lat:Float, lon:Float, groupingLevel:GroupingLevel, ...)`
- `updateWave(waveUuid:!, uuid:!, groupingLevel:GroupingLevel, ...)`
- `autoGroupPhotosIntoWaves(uuid:!, groupingLevel:GroupingLevel)`

### Requirement: Default GroupingLevel

When `groupingLevel` is omitted from a mutation:

- `createWave` → defaults to `CITY`
- `updateWave` → groupingLevel field unchanged
- `autoGroupPhotosIntoWaves` → defaults to `CITY`

### Requirement: Auto-group processes only ungrouped active photos

The system SHALL process active photos that are not linked in `WavePhotos`, ordered by `createdAt` ascending.

#### Scenario: Previously grouped photos are excluded

- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` runs
- **THEN** photos already present in `WavePhotos` are ignored

#### Scenario: Inactive photos are excluded

- **WHEN** user has inactive photos (`active=false`) not linked to any wave
- **THEN** those photos are not considered by auto-group

### Requirement: Auto-group uses field-matching grouping

For each invocation, photos are grouped into the same wave when their locality fields match based on the requested `groupingLevel`. Distance thresholds are removed.

| GroupingLevel | Fields Required to Match |
|---------------|--------------------------|
| DISTRICT      | locality + localityLevel + region + country + countryCode |
| CITY          | locality + region + country |
| REGION        | region + country |
| COUNTRY       | country |

#### Scenario: Auto-group with CITY groupingLevel

- **GIVEN** 100 photos all in "Manhattan, New York, United States"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** all 100 photos are grouped into one wave (regardless of distance)

#### Scenario: Auto-group with CITY groupingLevel — different cities

- **GIVEN** photos in "Manhattan, New York, United States" and "Brooklyn, New York, United States"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** photos are split into separate waves (locality differs: "Manhattan" vs "Brooklyn")

#### Scenario: Auto-group with REGION groupingLevel

- **GIVEN** photos in "Manhattan, New York, United States" and "Brooklyn, New York, United States"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: REGION`
- **THEN** all photos are grouped into one wave (region + country match)

#### Scenario: Auto-group with DISTRICT groupingLevel

- **GIVEN** photos in "Manhattan, New York, United States" and "Manhattan, California, United States"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: DISTRICT`
- **THEN** photos are split into separate waves (region differs)

#### Scenario: Auto-group with COUNTRY groupingLevel

- **GIVEN** photos in "New York, United States" and "Tokyo, Japan"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: COUNTRY`
- **THEN** photos are split into separate waves (country differs)

#### Scenario: Auto-group default groupingLevel

- **GIVEN** `autoGroupPhotosIntoWaves` called without groupingLevel parameter
- **WHEN** the mutation executes
- **THEN** CITY grouping is used

#### Scenario: Photos without location fields

- **WHEN** `autoGroupPhotosIntoWaves` runs and some photos have null locality fields
- **THEN** photos with null locality fields are grouped separately from photos with values, and into their own wave

### Requirement: Auto-group creates at most one wave per invocation

The mutation creates at most one wave per call. Caller must have a `Secrets` record. Created wave has `open=false`, `createdBy=uuid`, creator is inserted into `WaveUsers` with `role='owner'`, `splashDate` is the earliest grouped photo date, and `freezeDate` is the latest grouped photo date. The wave stores the groupingLevel used for grouping.

#### Scenario: Missing secret blocks grouping

- **WHEN** caller has no `Secrets` record
- **THEN** mutation fails

#### Scenario: Created wave is immediately frozen by date window

- **WHEN** grouped photos are historical
- **THEN** resulting wave uses historical `splashDate`/`freezeDate`, making it frozen under date rules

#### Scenario: createWave stores groupingLevel

- **GIVEN** `createWave` called with `groupingLevel: DISTRICT`
- **WHEN** the wave is created
- **THEN** the groupingLevel column is set to DISTRICT

#### Scenario: updateWave stores groupingLevel

- **GIVEN** `updateWave` called with `groupingLevel: REGION`
- **WHEN** the wave is updated
- **THEN** the groupingLevel column is updated to REGION

### Requirement: Grouped photos are linked and counts returned

All selected photos are linked to the created wave through `WavePhotos`. The result returns `photosGrouped`, `photosRemaining`, `hasMore`, `waveUuid`, and `name`.

#### Scenario: Remaining ungrouped photos

- **WHEN** ungrouped photos remain after a call
- **THEN** `hasMore=true` and `photosRemaining>0`

#### Scenario: Grouping complete

- **WHEN** no ungrouped photos remain
- **THEN** `hasMore=false` and `photosRemaining=0`

#### Scenario: Nothing grouped this invocation

- **WHEN** no eligible ungrouped photos are found at invocation start
- **THEN** result reports `photosGrouped=0`, `hasMore=false`, and `photosRemaining=0`

### Requirement: Wave name uses locality from groupingLevel

Wave name follows `<LocalityName>, <DateRange>`. The anchor photo (first with location) is reverse geocoded, and the locality at the selected groupingLevel is used for the name. If geocode fails, fallback to coordinates format.

#### Scenario: Wave name uses locality

- **GIVEN** anchor photo in Berlin
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** wave name is "Berlin, March 2026"

#### Scenario: Wave name fallback on geocode failure

- **GIVEN** anchor photo where geocode fails
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** wave name uses coordinates format

### Requirement: Locality key extraction for wave naming

A helper function MUST extract the appropriate locality field for the wave name based on groupingLevel:

- `DISTRICT` → `Address.Locality` (preferred) or `Address.District` (fallback)
- `CITY` → `Address.Locality` (preferred) or `Address.District` (fallback)
- `REGION` → `Address.Region.Name`
- `COUNTRY` → `Address.Country.Name`

### Requirement: Per-invocation locality cache

During auto-grouping:

- Geocode results MUST be cached per invocation using `"lat,lon"` key
- Photos at same coordinates reuse cached result
- Cache cleared between Lambda invocations

#### Scenario: Locality cache reduces API calls

- **GIVEN** 50 photos at same coordinates
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** reverse geocode is called once, not 50 times

## REMOVED Requirements

### Requirement: Granularity Distance Mapping

**Reason**: Distance thresholds replaced by field-matching. No more haversine distance calculations for grouping.

**Migration**: The `GRANULARITY_FALLBACKS` constant and `haversineDistance`/`computeClusterRadius` functions are removed from the grouping logic.

### Requirement: Radius is derived from group spread

**Reason**: Distance-based radius computation is removed along with the distance threshold approach. The wave's stored `radius` field will be set to a fixed default value (e.g., 50) since geo-fence radius is no longer meaningful with field-matching grouping.

**Migration**: `computeClusterRadius()` and `haversineDistance()` functions are removed. `radius` defaults to 50 for all new waves.
