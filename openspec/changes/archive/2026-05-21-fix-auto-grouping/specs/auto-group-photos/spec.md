## MODIFIED Requirements

### Requirement: Auto-group uses field-matching grouping

For each invocation, photos are grouped into the same wave when their locality fields match based on the requested `groupingLevel`. When string matching fails, a **spatial distance fallback** SHALL be used: if both the photo and the wave anchor have valid coordinates, the photo fits the wave when the Haversine distance is within the threshold for the grouping level.

| GroupingLevel | Fields Required to Match (primary) | Distance Fallback |
|---------------|-------------------------------------|-------------------|
| DISTRICT       | locality + district + region + country | ≤ 15 km |
| CITY           | locality + region + country | ≤ 50 km |
| REGION         | region + country | ≤ 300 km |
| COUNTRY        | country | ≤ 2000 km |

The matching logic SHALL be: string match OR (both have coordinates AND distance ≤ threshold).

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

#### Scenario: String mismatch but within distance threshold

- **GIVEN** photo A with locality="Paris", lat=48.856, lon=2.352 anchors a wave
- **AND** photo B with locality="Paris 9e Arrondissement", lat=48.879, lon=2.340 (2.6 km away)
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** photo B is grouped into the same wave as photo A (within 50 km threshold)

#### Scenario: Geocoding failure with valid coordinates within threshold

- **GIVEN** photo A with locality="Paris", lat=48.856, lon=2.352 anchors a wave
- **AND** photo B with locality="" (geocoding failed), lat=48.860, lon=2.355 (0.5 km away)
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** photo B is grouped into the same wave as photo A (within 50 km threshold)

#### Scenario: String mismatch and beyond distance threshold

- **GIVEN** photo A with locality="Paris", lat=48.856, lon=2.352 anchors a wave
- **AND** photo B with locality="Lyon", lat=45.764, lon=4.835 (392 km away)
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** photo B is NOT grouped into the same wave (strings don't match AND distance exceeds 50 km)

#### Scenario: Photos without coordinates or location fields

- **WHEN** a photo has no coordinates (lat/lon are null) AND no locality fields
- **THEN** string matching uses normalized null values; distance fallback is skipped

### Requirement: Grouped photos are linked and counts returned

All selected photos are linked to the created wave through `WavePhotos`. The result returns `photosGrouped`, `photosRemaining`, `hasMore`, `waveUuid`, and `name`.

#### Scenario: Remaining ungrouped photos after batch

- **WHEN** the batch limit is reached and ungrouped photos remain
- **THEN** `hasMore=true` and `photosRemaining` reflects the actual remaining count

#### Scenario: Grouping complete

- **WHEN** no ungrouped photos remain after processing
- **THEN** `hasMore=false` and `photosRemaining=0`

#### Scenario: Nothing grouped this invocation

- **WHEN** no eligible ungrouped photos are found at invocation start
- **THEN** result reports `photosGrouped=0`, `hasMore=false`, and `photosRemaining=0`

## ADDED Requirements

### Requirement: Batch processing with limit

The ungrouped photos query SHALL use a `LIMIT` of 200. After processing the batch, the system SHALL run a COUNT query to determine `photosRemaining` and set `hasMore` accordingly. The client MUST call the mutation repeatedly when `hasMore` is true.

#### Scenario: Large backlog processed in batches

- **GIVEN** a user has 1000 ungrouped photos
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** at most 200 photos are processed
- **AND** `hasMore=true` and `photosRemaining=800`

#### Scenario: Small backlog processed in single call

- **GIVEN** a user has 50 ungrouped photos
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** all 50 photos are processed
- **AND** `hasMore=false` and `photosRemaining=0`

### Requirement: Frequency maps scoped to current wave

The locality frequency tracking maps (`localityCounts`, `districtCounts`, `regionCounts`, `countryCounts`, `districtMap`, `regionMap`, `countryMap`) SHALL be cleared when a new wave is created. Frequency data from a previous wave MUST NOT influence the name refinement of subsequent waves.

#### Scenario: Frequency maps reset at wave boundary

- **GIVEN** wave 1 processes 50 photos in "Paris"
- **AND** the algorithm encounters a photo in "Lyon" that starts wave 2
- **WHEN** subsequent "Lyon" photos are processed for wave 2
- **THEN** the wave name reflects "Lyon" frequency data only, not accumulated "Paris" data from wave 1

### Requirement: Bulk INSERT for WavePhotos

Photos assigned to a wave during processing SHALL be inserted into `WavePhotos` using a single multi-row INSERT statement per wave, instead of individual INSERT statements per photo. The `photosCount` SHALL be reconciled with a single `_updatePhotosCount` call per wave rather than per-photo `_incrementPhotosCount` calls.

#### Scenario: Bulk insert performance

- **GIVEN** 150 photos match the current wave in a batch
- **WHEN** the photos are assigned to the wave
- **THEN** a single INSERT statement adds all 150 rows to `WavePhotos`
- **AND** `_updatePhotosCount` is called once for that wave
