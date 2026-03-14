# Auto Group Photos Spec

## Wave Boundary Detection

#### Scenario: Photos within 50km of anchor
- **GIVEN** ungrouped photos sorted by createdAt ASC
- **AND** the anchor is the first photo with a location
- **WHEN** a subsequent photo has a location within 50km of the anchor
- **THEN** it SHALL be included in the wave

#### Scenario: Location change boundary
- **GIVEN** ungrouped photos sorted by createdAt ASC
- **WHEN** a photo's location is >50km from the anchor
- **THEN** it SHALL NOT be included in the wave
- **AND** the walk SHALL stop (remaining photos left for next invocation)

#### Scenario: Locationless photos included
- **GIVEN** ungrouped photos sorted by createdAt ASC
- **WHEN** a photo has no location
- **THEN** it SHALL be included in the wave regardless of its position in the timeline

#### Scenario: All locationless photos
- **GIVEN** all ungrouped photos lack location data
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** it SHALL create a wave named "Uncategorized, {DateRange}"
- **AND** include all fetched photos (up to 1000)

## Wave Size Limit

#### Scenario: Max 1000 photos per invocation
- **GIVEN** more than 1000 ungrouped photos exist
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** it SHALL fetch at most 1000 oldest photos
- **AND** `hasMore` SHALL be `true` if ungrouped photos remain after processing

## Wave Naming

#### Scenario: Geocoding succeeds
- **GIVEN** an anchor photo with a location
- **WHEN** reverse geocoding returns a location name
- **THEN** the wave name SHALL be "{LocationName}, {DateRange}" in English

#### Scenario: Geocoding fails
- **GIVEN** an anchor photo with a location
- **WHEN** reverse geocoding fails or returns null
- **THEN** the wave name SHALL be "Uncategorized, {DateRange}"

## Return Contract

#### Scenario: Wave created
- **WHEN** photos are grouped into a new wave
- **THEN** the result SHALL include `waveUuid` (non-null), `name` (non-null), `photosGrouped` (>0)

#### Scenario: Nothing to process
- **WHEN** no ungrouped photos exist
- **THEN** the result SHALL include `waveUuid: null`, `name: null`, `photosGrouped: 0`, `hasMore: false`

#### Scenario: No absorb paths
- **WHEN** `autoGroupPhotosIntoWaves` is called
- **THEN** it SHALL either create exactly one new wave or return `photosGrouped: 0`
- **AND** there SHALL be no absorb-into-existing-wave logic

## GraphQL Schema

#### Requirement: Remove isNewWave
- **GIVEN** the `AutoGroupResult` GraphQL type
- **THEN** `isNewWave` SHALL be removed
- **AND** the type SHALL contain: `waveUuid: String`, `name: String`, `photosGrouped: Int!`, `photosRemaining: Int!`, `hasMore: Boolean!`
