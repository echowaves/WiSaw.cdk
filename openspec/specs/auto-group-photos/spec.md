# Spec: Auto-group Photos

## Purpose

Define how photos are grouped into waves using field-matching based on reverse geocoding locality data, not distance thresholds.

## Requirements

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

`autoGroupPhotosIntoWaves` SHALL NOT default `groupingLevel`. The GraphQL schema enforces `GroupingLevel!` (required, non-nullable). If the value is somehow null or undefined at the handler level, the system SHALL throw an error.

- `createWave` → defaults to `CITY`
- `updateWave` → groupingLevel field unchanged
- `autoGroupPhotosIntoWaves` → **MUST be provided, no default** **BREAKING**

#### Scenario: Missing groupingLevel throws error

- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel` as null or undefined
- **THEN** the system throws an error
- **AND** no photos are processed

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

### Requirement: Auto-group uses field-matching grouping

For each invocation, photos are grouped into the same wave when their locality fields match based on the requested `groupingLevel`. When string-matching fails, the system SHALL fall back to a batch PostGIS `ST_DWithin` check using `_filterPhotosInRadius` with `DISTANCE_THRESHOLDS_KM[groupingLevel]` as the radius override.

| GroupingLevel | Fields Required to Match | Distance Fallback Threshold |
|---------------|--------------------------|----------------------------|
| DISTRICT       | locality + district + region + country | 15 km |
| CITY           | locality + region + country | 50 km |
| REGION         | region + country | 300 km |
| COUNTRY        | country | 2000 km |

The auto-group loop SHALL use a **search-and-reuse** approach:
1. Take the first ungrouped photo. Call `findOrCreateWave(photo)` to find an existing matching wave or create a new one.
2. **Pass 1**: String-match each remaining photo against the current wave (sync, in-memory). Partition into matched, unmatched-but-could-distance-match, and skipped sets.
3. **Pass 2**: Call `_filterPhotosInRadius(unmatchedIds, waveUuid, DISTANCE_THRESHOLDS_KM[groupingLevel])` once to get the set of unmatched photos within threshold distance.
4. Walk photos chronologically: if string-matched or in the `ST_DWithin` result set, check season and count limits — if same season and count < 1000, add to wave. If different season or count reached 1000, close wave and call `findOrCreateWave` for this photo.
5. **Photos that fail both string-match and distance check SHALL be skipped** (left ungrouped for the next iteration), NOT used to break the current wave.
6. **The system SHALL NOT use an `isActive` flag.** There is no persistent cursor. Each invocation starts by searching for a matching wave or creating one. This makes infinite loops structurally impossible — every invocation processes at least the first ungrouped photo.

`findOrCreateWave(photo)` SHALL:
1. Query existing waves owned by the user (`createdBy = uuid`) matching the photo's locality fields (scoped by `groupingLevel`) OR within `ST_DWithin` distance threshold, with `photosCount < 1000` and same `groupingLevel`.
2. Filter candidates by season: `getSeasonKey(wave.splashDate) === getSeasonKey(photo.createdAt)`.
3. Select the most recently created matching wave (`ORDER BY createdAt DESC`).
4. If a match is found, resume the wave (load its photo count and locality frequency distribution).
5. If no match is found, create a new wave from the photo.

#### Scenario: Non-contiguous photos reuse existing wave

- **GIVEN** a wave "New York, Winter 2025" with 100 photos, owned by the user
- **AND** 200 ungrouped photos: 100 from LA, then 100 from NYC
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel: CITY`
- **THEN** the first photo is from LA → no existing LA wave → create "Los Angeles, Winter 2025"
- **AND** LA photos are grouped, NYC photos are skipped
- **WHEN** called again
- **THEN** the first photo is from NYC → existing "New York, Winter 2025" wave found
- **AND** NYC photos are added to the existing wave (now 200 photos)
- **AND** no duplicate NYC wave is created

#### Scenario: findOrCreateWave uses distance fallback

- **GIVEN** a wave with anchor coordinates at 40.7°N / 74.0°W, groupingLevel CITY
- **AND** an ungrouped photo with null locality but coordinates 40.8°N / 73.9°W (within 50 km)
- **WHEN** `findOrCreateWave` is called for this photo
- **THEN** the existing wave is matched via `ST_DWithin` distance fallback
- **AND** the photo is added to the existing wave

#### Scenario: findOrCreateWave picks most recent wave

- **GIVEN** two waves matching the same photo: "NYC, Winter 2025" created Jan 1 and "NYC, Winter 2025" created Jan 15
- **WHEN** `findOrCreateWave` is called
- **THEN** the Jan 15 wave is selected (most recently created)

#### Scenario: findOrCreateWave respects count limit

- **GIVEN** a matching wave with 999 photos
- **WHEN** `findOrCreateWave` is called and no other matching wave exists
- **THEN** the wave is resumed (has room for 1 more photo)
- **WHEN** the next photo also matches but would exceed 1000
- **THEN** closeWave is called, then `findOrCreateWave` is called again for the overflow photo
- **AND** if no other matching wave with room exists, a new wave is created

#### Scenario: findOrCreateWave respects season boundary

- **GIVEN** a wave "New York, Winter 2025" with 500 photos
- **AND** an ungrouped NYC photo created in March 2026 (Spring season)
- **WHEN** `findOrCreateWave` is called
- **THEN** the Winter wave does NOT match (different season)
- **AND** a new wave "New York, Spring 2026" is created

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

#### Scenario: No infinite loop possible

- **GIVEN** 200 ungrouped photos all from "Los Angeles"
- **AND** no existing wave matches
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** a new wave is created from the first photo
- **AND** `photosGrouped >= 1` (at minimum the first photo is always grouped)
- **AND** there is no stale cursor to deactivate

### Requirement: Auto-group creates at most one wave per invocation

The mutation creates at most one NEW wave per call, but MAY reuse an existing wave. Caller must have a `Secrets` record. Created wave has `open=false`, `createdBy=uuid`, creator is inserted into `WaveUsers` with `role='owner'`, `splashDate` is the earliest grouped photo date, and `freezeDate` is the latest grouped photo date. The wave stores the groupingLevel used for grouping. Wave name is computed from database locality fields (no reverse geocode calls).

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

#### Scenario: Existing wave reused without creating new

- **GIVEN** a matching wave exists with room for more photos
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** `wavesCreated = 0` and `isNewWave = false`
- **AND** the `waveUuid` in the result is the existing wave's UUID

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

### Requirement: Wave name uses locality from groupingLevel

Wave name follows `<LocalityName>, <Season> <Year>`. The locality at the selected groupingLevel is read from the database (no reverse geocode calls). If the relevant field is null, fallback to the photo's or wave's actual coordinates. If coordinates are also null, use "Unlocated".

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

#### Scenario: Wave name uses actual coordinates when geo fields are null

- **GIVEN** a photo with null locality, district, region, and country, but coordinates 42.3°N / 71.1°W
- **WHEN** a wave is created from this photo
- **THEN** wave name is `"42.3°N, 71.1°W, Winter 2025"`
- **AND** wave name is NOT `"0.0°N, 0.0°E, Winter 2025"`

#### Scenario: Wave name uses "Unlocated" when both geo and coordinates are null

- **GIVEN** a photo with null locality, district, region, country, lat, and lon
- **WHEN** a wave is created from this photo
- **THEN** wave name is `"Unlocated, Winter 2025"`

#### Scenario: Refined wave name uses anchor coordinates when refinement geo is null

- **GIVEN** a wave with anchor coordinates 42.3°N / 71.1°W
- **WHEN** wave name refinement produces null from `computeWaveNameFromKey`
- **THEN** the refined name uses the anchor coordinates: `"42.3°N, 71.1°W, Winter 2025"`

### Requirement: Wave name refinement by most-frequent locality

Wave name MUST be refined based on the most frequently occurring locality across ALL photos in a wave, not just the current batch. When resuming an existing wave, the system SHALL load the full locality frequency distribution from `WavePhotos` joined to `Photos` before processing new photos. New photos are accumulated on top of the existing distribution. The refined name reflects the full population.

#### Scenario: Wave name uses most-frequent locality

- **WHEN** auto-grouping processes 10 photos where 8 are from "Berlin-Mitte" and 2 are from "Potsdam"
- **THEN** the wave name reflects "Berlin-Mitte, Month Year", not "Potsdam, Month Year"

#### Scenario: Name refinement on resume considers all photos

- **GIVEN** an existing wave with 800 photos from "Berlin-Mitte" and 50 from "Potsdam"
- **WHEN** 50 new "Potsdam" photos are added to the wave
- **THEN** the frequency map is {Berlin-Mitte: 800, Potsdam: 100}
- **AND** the wave name remains "Berlin-Mitte, ..." (not renamed to Potsdam)

### Requirement: Anchor fields updated during processing

When the dominant locality changes during wave processing (e.g., more photos arrive with a different locality than the anchor), the following fields MUST be updated to reflect the new dominant locality: `anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`, and wave location (lat/lon).

#### Scenario: Anchor fields updated during refinement
- **WHEN** a wave anchored on "Potsdam" receives 5 subsequent photos from "Berlin-Mitte"
- **THEN** `anchorLocality` is updated to "Berlin-Mitte" and related anchor fields follow

### Requirement: Wave name persisted after refinement

The UPDATE query for the current wave MUST include the `name` column so refined names are persisted to DB. Previously, only `splashDate`, `freezeDate`, and `updatedAt` were written; `name` was omitted.

#### Scenario: Wave name persisted after refinement
- **WHEN** the final UPDATE query executes at end of auto-grouping (after a name has been refined during photo processing)
- **THEN** the database row contains the refined name, not the original creation name

### Requirement: Photo count updated after each assignment

When a photo is assigned to an existing wave during auto-grouping, `_updatePhotosCount(waveUuid)` MUST be called immediately after the INSERT into `"WavePhotos"` so that the wave's `photosCount` column reflects the current count without waiting for all photos to finish processing.

#### Scenario: Photo count updated mid-processing
- **WHEN** auto-grouping is processing 100 ungrouped photos and photo #50 is inserted into WavePhotos
- **THEN** `_updatePhotosCount` has been called 49 times already, so `photosCount = 49`

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

### Requirement: findMatchingWave skips frozen waves

When searching for an existing wave to reuse, `findMatchingWave` SHALL skip any wave that is currently frozen (as determined by `_isWaveFrozen`). This applies regardless of whether the wave is frozen by date rules (`AUTO` mode) or by explicit override (`FROZEN` mode).

#### Scenario: Old wave with broken dates is skipped

- **GIVEN** an existing wave with `splashDate = freezeDate = "2026-03-15"` (instantly frozen under AUTO)
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the frozen wave is skipped
- **AND** a new wave is created with correct season boundary dates

#### Scenario: Manually frozen wave is skipped

- **GIVEN** an existing wave with `freezeMode = "FROZEN"`
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the manually frozen wave is skipped

#### Scenario: Unfrozen wave in current season is reused

- **GIVEN** an existing wave with season-aligned dates for the current season (unfrozen)
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the unfrozen wave is returned for reuse

#### Scenario: Explicitly unfrozen wave is reused

- **GIVEN** an existing wave with `freezeMode = "UNFROZEN"`
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the wave is returned for reuse (explicit UNFROZEN overrides date rules)
