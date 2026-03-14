# Auto Group Photos Spec

## isNewWave Flag

#### Scenario: New wave created via geocoding
- **WHEN** `autoGroupPhotosIntoWaves` creates a new wave (geocoding success or "Uncategorized" fallback)
- **THEN** the result SHALL include `isNewWave: true`
- **AND** `waveUuid` SHALL be the UUID of the newly created wave
- **AND** `name` SHALL be the wave name

#### Scenario: Photos absorbed into existing wave
- **WHEN** `autoGroupPhotosIntoWaves` absorbs photos into an existing wave (geocoding failure or locationless handling with existing waves)
- **THEN** the result SHALL include `isNewWave: false`
- **AND** `waveUuid` SHALL be `null`
- **AND** `name` SHALL be `null`

#### Scenario: Nothing to process
- **WHEN** there are no ungrouped photos
- **THEN** the result SHALL include `isNewWave: false`, `photosGrouped: 0`

## GraphQL Schema

#### Requirement: AutoGroupResult type
- **GIVEN** the `AutoGroupResult` GraphQL type
- **THEN** it SHALL include `isNewWave: Boolean!` as a required non-nullable field

## Code Simplification

#### Requirement: Single temporal splitting function
- **GIVEN** the need to split photos by temporal gaps
- **THEN** there SHALL be a single `splitByTemporalGaps` function that works on any array of `{ id, createdAt }` objects
- **AND** the duplicate `splitUngroupedByTemporalGaps` function SHALL be removed

#### Requirement: No separate handleUnresolvablePhotos
- **GIVEN** the locationless photo handling logic
- **THEN** it SHALL be inlined into `main()` rather than in a separate function
- **AND** the absorb-or-create fallback logic SHALL not be duplicated

#### Requirement: Simplified assignPhotosToNearestWave
- **GIVEN** absorb paths now return `isNewWave: false` with null waveUuid
- **THEN** `assignPhotosToNearestWave` SHALL return only the count of assigned photos (number)
- **AND** the `primaryWaveUuid`/`primaryWaveName` tracking SHALL be removed
