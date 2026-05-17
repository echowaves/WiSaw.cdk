# Spec: Auto-group Photos

## Capability: Auto-group Photos

### Overview
Photo grouping uses semantic locality instead of fixed radius. The `radius: Int` parameter is replaced with `granularity: GranularityEnum` on all wave mutations.

### Requirements

#### REQ-1: Granularity Enum
A new `Granularity` enum MUST be added to the GraphQL schema with values:
- `DISTRICT` — neighborhood/borough level (10km fallback)
- `CITY` — city/town level (50km fallback, default)
- `REGION` — state/province level (250km fallback)
- `COUNTRY` — country level (1000km fallback)

#### REQ-2: Mutation Parameter Replacement
The following mutations MUST replace `radius: Int` with `granularity: Granularity`:
- `createWave(name:!, description:!, uuid:!, lat:Float, lon:Float, granularity:Granularity, ...)`
- `updateWave(waveUuid:!, uuid:!, granularity:Granularity, ...)`
- `autoGroupPhotosIntoWaves(uuid:!, granularity:Granularity)`

#### REQ-3: Granularity Distance Mapping
The following distance thresholds MUST be used for photo grouping:
| Granularity | Distance |
|-------------|----------|
| DISTRICT    | 10 km    |
| CITY        | 50 km    |
| REGION      | 250 km   |
| COUNTRY     | 1000 km  |

#### REQ-4: Default Granularity
When `granularity` is omitted from a mutation:
- `createWave` → defaults to `CITY` (50km)
- `updateWave` → granularity field unchanged
- `autoGroupPhotosIntoWaves` → defaults to `CITY` (50km)

#### REQ-5: Wave Name from Locality
When auto-grouping photos:
- The anchor photo (first with location) is reverse geocoded
- Wave name uses locality at the selected granularity level
- Format: `{localityName}, {dateRange}` (e.g., "Berlin, March 2026")
- If geocode fails → fallback to coordinates format (existing behavior)

#### REQ-6: Locality Key Extraction
A helper function MUST extract the appropriate locality field based on granularity:
- `DISTRICT` → `Address.District`
- `CITY` → `Address.Locality` (fallback to District)
- `REGION` → `Address.Region.Name`
- `COUNTRY` → `Address.Country.Name`

#### REQ-7: Per-Invocation Locality Cache
During auto-grouping:
- Geocode results MUST be cached per invocation using `"lat,lon"` key
- Photos at same coordinates reuse cached result
- Cache cleared between Lambda invocations

#### REQ-8: Wave Stored Radius Unchanged
The wave's stored `radius` field (geo-fence) is computed from the photo cluster via `computeClusterRadius()` and is NOT affected by granularity parameter.

### Tests

#### T1: Auto-group with CITY granularity
GIVEN 100 photos within 50km of anchor
WHEN autoGroupPhotosIntoWaves is called with granularity: CITY
THEN all 100 photos are grouped into one wave

#### T2: Auto-group with DISTRICT granularity
GIVEN 100 photos spread across 20km
WHEN autoGroupPhotosIntoWaves is called with granularity: DISTRICT
THEN photos are split into multiple waves (threshold 10km)

#### T3: Auto-group with REGION granularity
GIVEN 100 photos spread across 200km
WHEN autoGroupPhotosIntoWaves is called with granularity: REGION
THEN all photos are grouped (threshold 250km)

#### T4: Auto-group default granularity
GIVEN autoGroupPhotosIntoWaves called without granularity parameter
WHEN the mutation executes
THEN CITY (50km) threshold is used

#### T5: Wave name uses locality
GIVEN anchor photo in Berlin
WHEN autoGroupPhotosIntoWaves is called
THEN wave name is "Berlin, March 2026"

#### T6: Wave name fallback on geocode failure
GIVEN anchor photo where geocode fails
WHEN autoGroupPhotosIntoWaves is called
THEN wave name uses coordinates format

#### T7: Locality cache reduces API calls
GIVEN 50 photos at same coordinates
WHEN autoGroupPhotosIntoWaves is called
THEN reverse geocode is called once, not 50 times

#### T8: createWave stores granularity
GIVEN createWave called with granularity: DISTRICT
WHEN the wave is created
THEN the granularity column is set to DISTRICT

#### T9: updateWave stores granularity
GIVEN updateWave called with granularity: REGION
WHEN the wave is updated
THEN the granularity column is updated to REGION
