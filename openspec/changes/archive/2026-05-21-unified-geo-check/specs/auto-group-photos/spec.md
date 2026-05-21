## MODIFIED Requirements

### Requirement: Auto-group uses field-matching grouping

For each invocation, photos are grouped into the same wave when their locality fields match based on the requested `groupingLevel`. When string-matching fails, the system SHALL fall back to a batch PostGIS `ST_DWithin` check using `_filterPhotosInRadius` with `DISTANCE_THRESHOLDS_KM[groupingLevel]` as the radius override, instead of in-memory haversine calculations.

| GroupingLevel | Fields Required to Match | Distance Fallback Threshold |
|---------------|--------------------------|----------------------------|
| DISTRICT       | locality + district + region + country | 15 km |
| CITY           | locality + region + country | 50 km |
| REGION         | region + country | 300 km |
| COUNTRY        | country | 2000 km |

The auto-group loop SHALL use a two-pass approach per wave:
1. **Pass 1**: String-match each photo against the active wave (sync, in-memory). Partition into matched and unmatched sets.
2. **Pass 2**: Call `_filterPhotosInRadius(unmatchedIds, waveUuid, DISTANCE_THRESHOLDS_KM[groupingLevel])` once to get the set of unmatched photos within threshold distance.
3. Walk photos chronologically: if string-matched or in the `ST_DWithin` result set, accumulate for the current wave. On the first photo failing both checks, flush accumulated photos, create a new wave, and repeat.

#### Scenario: String match succeeds — no distance check
- **WHEN** a photo's locality fields match the active wave's anchor fields for the given groupingLevel
- **THEN** the photo SHALL be grouped into the wave without any PostGIS query

#### Scenario: String match fails — distance fallback within threshold
- **WHEN** a photo's locality fields do not match the active wave but the photo's location is within `DISTANCE_THRESHOLDS_KM[groupingLevel]` of the wave's location
- **THEN** the photo SHALL be grouped into the wave via the batch `ST_DWithin` check

#### Scenario: Both checks fail — new wave created
- **WHEN** a photo fails both string-matching and the batch `ST_DWithin` distance check
- **THEN** a new wave SHALL be created starting from that photo

#### Scenario: Batch distance check is one query per wave
- **GIVEN** 200 photos where 150 string-match and 50 need distance fallback
- **WHEN** the distance fallback runs for the current wave
- **THEN** exactly one `ST_DWithin` query SHALL be executed for all 50 unmatched photos, not one per photo
