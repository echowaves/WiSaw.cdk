# Spec: Auto-group Photos

## Purpose
Define how photos are grouped into waves using semantic locality-based granularity instead of fixed radius distances.

## Requirements

### Requirement: Granularity Enum
A `Granularity` enum MUST be available in the GraphQL schema with values:
- `DISTRICT` — neighborhood/borough level (10km fallback)
- `CITY` — city/town level (50km fallback, default)
- `REGION` — state/province level (250km fallback)
- `COUNTRY` — country level (1000km fallback)

### Requirement: Mutation Parameter Replacement
The following mutations MUST accept `granularity: Granularity` instead of `radius: Int`:
- `createWave(name:!, description:!, uuid:!, lat:Float, lon:Float, granularity:Granularity, ...)`
- `updateWave(waveUuid:!, uuid:!, granularity:Granularity, ...)`
- `autoGroupPhotosIntoWaves(uuid:!, granularity:Granularity)`

### Requirement: Granularity Distance Mapping
The following distance thresholds MUST be used for photo grouping:
| Granularity | Distance |
|-------------|----------|
| DISTRICT    | 10 km    |
| CITY        | 50 km    |
| REGION      | 250 km   |
| COUNTRY     | 1000 km  |

### Requirement: Default Granularity
When `granularity` is omitted from a mutation:
- `createWave` → defaults to `CITY` (50km)
- `updateWave` → granularity field unchanged
- `autoGroupPhotosIntoWaves` → defaults to `CITY` (50km)

### Requirement: Auto-group processes only ungrouped active photos
The system SHALL process active photos that are not linked in `WavePhotos`, ordered by `createdAt` ascending.

#### Scenario: Previously grouped photos are excluded
- **WHEN** `autoGroupPhotosIntoWaves(uuid, granularity)` runs
- **THEN** photos already present in `WavePhotos` are ignored

#### Scenario: Inactive photos are excluded
- **WHEN** user has inactive photos (`active=false`) not linked to any wave
- **THEN** those photos are not considered by auto-group

### Requirement: Auto-group uses granularity-based geo grouping
For each invocation, the first geolocated photo in the candidate set is used as an anchor. Photos within the distance threshold corresponding to the selected granularity level are grouped with it. Photos without location may still be included in the grouped set processed by that invocation.

#### Scenario: One invocation processes one group
- **WHEN** multiple disjoint candidate groups exist
- **THEN** only one group is processed in that call

#### Scenario: No geolocated photo in candidates
- **WHEN** candidate set has only locationless photos
- **THEN** grouping still processes one invocation group, without geo-distance partitioning

#### Scenario: Auto-group with CITY granularity
- **GIVEN** 100 photos within 50km of anchor
- **WHEN** `autoGroupPhotosIntoWaves` is called with `granularity: CITY`
- **THEN** all 100 photos are grouped into one wave

#### Scenario: Auto-group with DISTRICT granularity
- **GIVEN** 100 photos spread across 20km
- **WHEN** `autoGroupPhotosIntoWaves` is called with `granularity: DISTRICT`
- **THEN** photos are split into multiple waves (threshold 10km)

#### Scenario: Auto-group with REGION granularity
- **GIVEN** 100 photos spread across 200km
- **WHEN** `autoGroupPhotosIntoWaves` is called with `granularity: REGION`
- **THEN** all photos are grouped (threshold 250km)

#### Scenario: Auto-group default granularity
- **GIVEN** `autoGroupPhotosIntoWaves` called without granularity parameter
- **WHEN** the mutation executes
- **THEN** CITY (50km) threshold is used

### Requirement: Auto-group creates at most one wave per invocation
The mutation creates at most one wave per call. Caller must have a `Secrets` record. Created wave has `open=false`, `createdBy=uuid`, creator is inserted into `WaveUsers` with `role='owner'`, `splashDate` is the earliest grouped photo date, and `freezeDate` is the latest grouped photo date. The wave stores the granularity used for grouping.

#### Scenario: Missing secret blocks grouping
- **WHEN** caller has no `Secrets` record
- **THEN** mutation fails

#### Scenario: Created wave is immediately frozen by date window
- **WHEN** grouped photos are historical
- **THEN** resulting wave uses historical `splashDate`/`freezeDate`, making it frozen under date rules

#### Scenario: createWave stores granularity
- **GIVEN** `createWave` called with `granularity: DISTRICT`
- **WHEN** the wave is created
- **THEN** the granularity column is set to DISTRICT

#### Scenario: updateWave stores granularity
- **GIVEN** `updateWave` called with `granularity: REGION`
- **WHEN** the wave is updated
- **THEN** the granularity column is updated to REGION

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

### Requirement: Radius is derived from group spread
If geolocated photos exist, radius is computed from max anchor distance as `max(maxDistance*1.2, maxDistance+10, 5)`. If no geolocated photos exist, location is `NULL` and no geo-fence radius calculation is applied from coordinates. The wave's stored `radius` field (geo-fence) is computed from the photo cluster via `computeClusterRadius()` and is NOT affected by the granularity parameter.

#### Scenario: Radius floor applies to tight clusters
- **WHEN** all grouped geolocated photos are very close to anchor
- **THEN** radius is at least 5km

#### Scenario: Additive buffer dominates percentage buffer
- **WHEN** `maxDistance+10` is greater than `maxDistance*1.2`
- **THEN** additive buffer branch defines radius

### Requirement: Wave name uses locality from granularity
Wave name follows `<LocalityName>, <DateRange>`. The anchor photo (first with location) is reverse geocoded, and the locality at the selected granularity level is used. If geocode fails, fallback to coordinates format.

#### Scenario: Wave name uses locality
- **GIVEN** anchor photo in Berlin
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** wave name is "Berlin, March 2026"

#### Scenario: Wave name fallback on geocode failure
- **GIVEN** anchor photo where geocode fails
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** wave name uses coordinates format

### Requirement: Locality key extraction
A helper function MUST extract the appropriate locality field based on granularity:
- `DISTRICT` → `Address.District`
- `CITY` → `Address.Locality` (fallback to District)
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