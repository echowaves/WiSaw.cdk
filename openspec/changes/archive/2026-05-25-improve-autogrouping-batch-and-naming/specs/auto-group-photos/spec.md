## MODIFIED Requirements

### Requirement: Batch processing with limit

The ungrouped photos query SHALL use a `LIMIT` of 1000. After processing the batch, the system SHALL run a COUNT query to determine `photosRemaining` and set `hasMore` accordingly. The client MUST call the mutation repeatedly when `hasMore` is true.

#### Scenario: Large backlog processed in batches

- **GIVEN** a user has 2000 ungrouped photos
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** at most 1000 photos are processed
- **AND** `hasMore=true` and `photosRemaining=1000`

#### Scenario: Small backlog processed in single call

- **GIVEN** a user has 50 ungrouped photos
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** all 50 photos are processed
- **AND** `hasMore=false` and `photosRemaining=0`

#### Scenario: Medium backlog fills wave in single call

- **GIVEN** a user has 800 ungrouped photos all from the same locality and season
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** all 800 photos are grouped into one wave in a single invocation
- **AND** `hasMore=false` and `photosRemaining=0`

### Requirement: Wave name refinement by most-frequent locality

Wave name MUST be refined based on the most frequently occurring **non-null** locality across ALL photos in a wave, not just the current batch. Photos with null locality fields SHALL be excluded from the frequency count — the "unknown" sentinel SHALL NOT compete with real locality names. When resuming an existing wave, the system SHALL load the full locality frequency distribution from `WavePhotos` joined to `Photos` before processing new photos. New photos are accumulated on top of the existing distribution. The refined name reflects the full population.

If all photos in the wave have null locality, `getMostFrequentLocality` SHALL return `null`, causing the wave name to fall through to the coordinate-based fallback (`coordinateFallbackName`).

#### Scenario: Wave name uses most-frequent locality

- **WHEN** auto-grouping processes 10 photos where 8 are from "Berlin-Mitte" and 2 are from "Potsdam"
- **THEN** the wave name reflects "Berlin-Mitte, Month Year", not "Potsdam, Month Year"

#### Scenario: Name refinement on resume considers all photos

- **GIVEN** an existing wave with 800 photos from "Berlin-Mitte" and 50 from "Potsdam"
- **WHEN** 50 new "Potsdam" photos are added to the wave
- **THEN** the frequency map is {Berlin-Mitte: 800, Potsdam: 100}
- **AND** the wave name remains "Berlin-Mitte, ..." (not renamed to Potsdam)

#### Scenario: Null-locality photos do not affect wave name

- **GIVEN** a wave with 150 photos with null locality and 50 photos with locality "Berlin"
- **WHEN** wave name refinement runs
- **THEN** the wave name is "Berlin, Season Year"
- **AND** the 150 null-locality photos are excluded from frequency counting

#### Scenario: All-null-locality wave uses coordinate fallback

- **GIVEN** a wave where all photos have null locality but anchor coordinates 40.7°N / 74.0°W
- **WHEN** wave name refinement runs
- **THEN** `getMostFrequentLocality` returns null
- **AND** the wave name falls back to "40.7°N, 74.0°W, Season Year"
