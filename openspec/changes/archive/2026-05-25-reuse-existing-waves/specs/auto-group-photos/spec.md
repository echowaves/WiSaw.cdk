## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Stale active wave deactivated on zero progress

**Reason**: The `isActive` cursor is removed entirely. Without a persistent cursor, there is no stale wave to deactivate. Every invocation uses `findOrCreateWave` which always makes progress (at least the first photo is grouped).

**Migration**: No action needed. The stale detection code and `isActive` column are removed. The infinite loop bug class is eliminated structurally.
