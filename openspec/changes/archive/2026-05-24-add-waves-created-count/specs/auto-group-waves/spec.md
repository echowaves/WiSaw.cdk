## ADDED Requirements

### Requirement: AutoGroupResult Includes wavesCreated

The `AutoGroupResult` type MUST include a `wavesCreated: Int!` field reporting the total number of new waves created during the auto-grouping operation.

#### Scenario: No waves created (all photos fit existing wave)

- **GIVEN** a user with an active wave and ungrouped photos that all fit
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` is called
- **THEN** `wavesCreated=0`

#### Scenario: One new wave created

- **GIVEN** a user with an active wave and one photo that drifts geographically
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` is called
- **THEN** `wavesCreated=1`

#### Scenario: Multiple waves created in batch

- **GIVEN** 50 ungrouped photos spanning multiple geographic areas
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel)` is called
- **THEN** `wavesCreated=N` where N equals the number of new waves created during processing
