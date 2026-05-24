## MODIFIED Requirements

### Requirement: Default GroupingLevel

`autoGroupPhotosIntoWaves` SHALL NOT default `groupingLevel`. The GraphQL schema enforces `GroupingLevel!` (required, non-nullable). If the value is somehow null or undefined at the handler level, the system SHALL throw an error.

- `createWave` → defaults to `CITY`
- `updateWave` → groupingLevel field unchanged
- `autoGroupPhotosIntoWaves` → **MUST be provided, no default** **BREAKING**

#### Scenario: Missing groupingLevel throws error

- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel` as null or undefined
- **THEN** the system throws an error
- **AND** no photos are processed

### Requirement: Auto-group uses field-matching grouping

For each invocation, photos are grouped into the same wave when their locality fields match based on the requested `groupingLevel`. When string-matching fails, the system SHALL fall back to a batch PostGIS `ST_DWithin` check using `_filterPhotosInRadius` with `DISTANCE_THRESHOLDS_KM[groupingLevel]` as the radius override.

| GroupingLevel | Fields Required to Match | Distance Fallback Threshold |
|---------------|--------------------------|----------------------------|
| DISTRICT       | locality + district + region + country | 15 km |
| CITY           | locality + region + country | 50 km |
| REGION         | region + country | 300 km |
| COUNTRY        | country | 2000 km |

The auto-group loop SHALL use a **skip-non-matching** approach:
1. **Pass 1**: String-match each photo against the active wave (sync, in-memory). Partition into matched, unmatched-but-could-distance-match, and skipped sets.
2. **Pass 2**: Call `_filterPhotosInRadius(unmatchedIds, waveUuid, DISTANCE_THRESHOLDS_KM[groupingLevel])` once to get the set of unmatched photos within threshold distance.
3. Walk photos chronologically: if string-matched or in the `ST_DWithin` result set, check season and count limits — if same season and count < 1000, add to wave. If different season or count reached 1000, close wave and start new wave from this photo.
4. **Photos that fail both string-match and distance check SHALL be skipped** (left ungrouped for the next iteration), NOT used to break the current wave.

#### Scenario: Auto-group skips non-matching photos

- **GIVEN** 10 photos chronologically: 5 in "New York, US", 2 in "Chicago, US", 3 in "New York, US"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** all 8 "New York" photos are grouped into one wave
- **AND** the 2 "Chicago" photos are left ungrouped
- **AND** `hasMore` is true (ungrouped photos remain)

#### Scenario: Next iteration picks up skipped photos

- **GIVEN** the previous iteration left 2 "Chicago" photos ungrouped
- **WHEN** `autoGroupPhotosIntoWaves` is called again
- **THEN** the 2 "Chicago" photos are grouped into a new wave
- **AND** `hasMore` is false

#### Scenario: Null-geo photos are skipped then self-grouped

- **GIVEN** photos: "NYC", null-geo, "NYC", null-geo
- **WHEN** first `autoGroupPhotosIntoWaves` call with `groupingLevel: CITY`
- **THEN** both "NYC" photos are in one wave, null-geo photos left ungrouped
- **WHEN** second call runs
- **THEN** null-geo photos form their own wave(s) with coordinate-based naming

#### Scenario: Auto-group with CITY groupingLevel

- **GIVEN** 100 photos all in "Manhattan, New York, United States"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** all 100 photos are grouped into one wave (regardless of distance)

#### Scenario: Auto-group with CITY groupingLevel — different cities

- **GIVEN** photos in "Manhattan, New York, United States" and "Brooklyn, New York, United States"
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** Manhattan photos grouped into one wave, Brooklyn photos left ungrouped (or vice versa depending on chronological order)
- **AND** subsequent call groups the remaining city's photos

#### Scenario: Season boundary closes wave

- **GIVEN** 50 photos in "New York" spanning February and March 2026
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** February photos are in wave "New York, Winter 2025"
- **AND** March photos are in wave "New York, Spring 2026"

#### Scenario: Wave count limit closes wave

- **GIVEN** 1500 photos in "New York" all in Winter 2025
- **WHEN** `autoGroupPhotosIntoWaves` is called repeatedly
- **THEN** first 1000 photos are in one wave
- **AND** remaining 500 photos are in a second wave

### Requirement: Wave name uses locality from groupingLevel

Wave name follows `<LocalityName>, <Season> <Year>`. The locality at the selected groupingLevel is read from the database (no reverse geocode calls). If the relevant field is null, fallback to coordinates format.

- `DISTRICT` → uses `photo.district` from database
- `CITY` → uses `photo.locality` from database
- `REGION` → uses `photo.region` from database
- `COUNTRY` → uses `photo.country` from database

#### Scenario: Wave name uses season format

- **GIVEN** anchor photo with locality "New York" in database, created in January 2026
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** wave name is "New York, Winter 2025"

#### Scenario: Wave name fallback on null locality

- **GIVEN** anchor photo with null locality, coordinates 40.7°N / 74.0°W, created in July 2026
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** wave name is "40.7°N, 74.0°W, Summer 2026"
