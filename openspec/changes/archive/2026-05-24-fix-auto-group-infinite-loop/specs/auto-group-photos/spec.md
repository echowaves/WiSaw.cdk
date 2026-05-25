## MODIFIED Requirements

### Requirement: Auto-group uses field-matching grouping

For each invocation, photos are grouped into the same wave when their locality fields match based on the requested `groupingLevel`. When string-matching fails, the system SHALL fall back to a batch PostGIS `ST_DWithin` check using `_filterPhotosInRadius` with `DISTANCE_THRESHOLDS_KM[groupingLevel]` as the radius override.

The auto-group loop SHALL use a **skip-non-matching** approach:
1. **Pass 1**: String-match each photo against the active wave (sync, in-memory). Partition into matched, unmatched-but-could-distance-match, and skipped sets.
2. **Pass 2**: Call `_filterPhotosInRadius(unmatchedIds, waveUuid, DISTANCE_THRESHOLDS_KM[groupingLevel])` once to get the set of unmatched photos within threshold distance.
3. Walk photos chronologically: if string-matched or in the `ST_DWithin` result set, check season and count limits — if same season and count < 1000, add to wave. If different season or count reached 1000, close wave and start new wave from this photo.
4. **Photos that fail both string-match and distance check SHALL be skipped** (left ungrouped for the next iteration), NOT used to break the current wave.
5. **After the processing loop, if `photosGrouped` is 0 and an active wave exists, the system SHALL deactivate the active wave** so the next call can start fresh with a new anchor. This prevents infinite loops when no ungrouped photos match the current wave's locality.

#### Scenario: Stale active wave deactivated on zero progress

- **GIVEN** an active wave anchored on "New York" at CITY level
- **AND** 200 ungrouped photos all from "Los Angeles"
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** all 200 photos are skipped (none match "New York")
- **AND** the active "New York" wave is deactivated (`isActive = false`)
- **AND** `photosGrouped = 0`, `hasMore = true`
- **WHEN** the next call is made
- **THEN** no active wave exists, so a new wave is created from the first "Los Angeles" photo
- **AND** photos are grouped normally

#### Scenario: Zero-progress does not loop infinitely

- **GIVEN** an active wave whose locality matches none of the remaining ungrouped photos
- **WHEN** `autoGroupPhotosIntoWaves` is called repeatedly
- **THEN** the first call deactivates the stale wave
- **AND** the second call creates a new wave and makes progress
- **AND** the loop terminates
