# Spec: Auto-group Photos (Delta)

## Purpose

Delta spec for modified requirements in auto-grouping that no longer call reverse geocode and use database fields directly.

## REMOVED Requirements

### Requirement: Auto-group uses granularity-based geo grouping
**Reason**: Replaced by field-matching grouping that reads from database (no reverse geocode calls)
**Migration**: Auto-grouping now reads all locality fields from database columns; reverse geocode is eliminated from the grouping loop

### Requirement: Locality key extraction
**Reason**: Replaced by field-matching using database columns directly
**Migration**: `computeGroupingKey` and `computeWaveNameFromKey` functions use database fields instead of reverse geocode results

### Requirement: Per-invocation locality cache
**Reason**: No longer needed — reverse geocode calls are eliminated from auto-grouping
**Migration**: Locality cache is removed; all data comes from database columns

## MODIFIED Requirements

### Requirement: Auto-group processes only ungrouped active photos
The system SHALL process active photos that are not linked in `WavePhotos`, ordered by `createdAt` ascending. For each photo, locality data (including `district`) SHALL be read from the database — no reverse geocode API calls SHALL be made during auto-grouping.

#### Scenario: Previously grouped photos are excluded
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` runs
- **THEN** photos already present in `WavePhotos` are ignored

#### Scenario: Inactive photos are excluded
- **WHEN** user has inactive photos (`active=false`) not linked to any wave
- **THEN** those photos are not considered by auto-group

#### Scenario: No reverse geocode calls during auto-grouping
- **GIVEN** 100 photos needing auto-grouping
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** zero reverse geocode API calls are made
- **AND** all locality data is read from database columns

### Requirement: Auto-group creates at most one wave per invocation
The mutation creates at most one wave per call. Caller must have a `Secrets` record. Created wave has `open=false`, `createdBy=uuid`, creator is inserted into `WaveUsers` with `role='owner'`, `splashDate` is the earliest grouped photo date, and `freezeDate` is the latest grouped photo date. The wave stores the groupingLevel used for grouping. Wave name is computed from database locality fields (no reverse geocode calls).

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

### Requirement: Wave name uses locality from groupingLevel
Wave name follows `<LocalityName>, <DateRange>`. The locality at the selected groupingLevel is read from the database (no reverse geocode calls). If the relevant field is null, fallback to coordinates format.

- `DISTRICT` → uses `photo.district` from database
- `CITY` → uses `photo.locality` from database
- `REGION` → uses `photo.region` from database
- `COUNTRY` → uses `photo.country` from database

#### Scenario: Wave name uses district for DISTRICT grouping
- **GIVEN** anchor photo with district "Brooklyn" in database
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: DISTRICT`
- **THEN** wave name is "Brooklyn, March 2026"

#### Scenario: Wave name uses locality for CITY grouping
- **GIVEN** anchor photo with locality "New York" in database
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** wave name is "New York, March 2026"

#### Scenario: Wave name fallback on null district
- **GIVEN** anchor photo with null district in database
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: DISTRICT`
- **THEN** wave name uses fallback (coordinates or district from locality)
