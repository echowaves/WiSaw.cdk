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
3. **Skip waves that are explicitly user-frozen (`freezeMode = 'FROZEN'`)**. Waves with `freezeMode = 'AUTO'` (or NULL) or `freezeMode = 'UNFROZEN'` SHALL NOT be skipped, regardless of whether their `freezeDate` is in the past. Date-based freeze is a user-facing concept and SHALL NOT prevent auto-grouping from filling waves across batches.
4. Select the most recently created matching wave (`ORDER BY createdAt DESC`).
5. If a match is found, resume the wave (load its photo count and locality frequency distribution).
6. If no match is found, create a new wave from the photo.

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

#### Scenario: Historical wave reused across batches

- **GIVEN** 500 ungrouped photos from "Berlin, Summer 2024"
- **AND** no existing wave matches
- **WHEN** `autoGroupPhotosIntoWaves` is called (batch 1, 200 photos)
- **THEN** a new wave "Berlin, Summer 2024" is created with `freezeDate = 2024-08-31`
- **AND** 200 photos are grouped into it
- **WHEN** called again (batch 2, 200 photos)
- **THEN** `findMatchingWave` finds the existing "Berlin, Summer 2024" wave
- **AND** the wave is NOT skipped despite `freezeDate < now`
- **AND** 200 more photos are added (wave now has 400 photos)
- **WHEN** called again (batch 3, 100 photos)
- **THEN** remaining 100 photos are added (wave now has 500 photos)

#### Scenario: Explicitly frozen wave skipped by auto-grouping

- **GIVEN** a wave "Tokyo, Fall 2025" with `freezeMode = 'FROZEN'` and 50 photos
- **AND** 100 ungrouped photos from Tokyo in Fall 2025
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** `findMatchingWave` skips the frozen wave
- **AND** a new wave is created for the Tokyo photos

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

#### Scenario: No infinite loop possible

- **GIVEN** 200 ungrouped photos all from "Los Angeles"
- **AND** no existing wave matches
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** a new wave is created from the first photo
- **AND** `photosGrouped >= 1` (at minimum the first photo is always grouped)
- **AND** there is no stale cursor to deactivate
