## ADDED Requirements

### Requirement: Auto-group photos into waves mutation
The system SHALL expose an `autoGroupPhotosIntoWaves(uuid)` GraphQL mutation that triggers automatic grouping of a user's ungrouped photos into waves.

#### Scenario: Mutation invoked
- **WHEN** `autoGroupPhotosIntoWaves(uuid: String!)` is called via GraphQL
- **THEN** the system SHALL execute the auto-grouping logic for the specified user and return an `AutoGroupResult` containing `wavesCreated` and `photosGrouped`

#### Scenario: AutoGroupResult type
- **WHEN** the mutation completes
- **THEN** the result SHALL conform to the GraphQL type `AutoGroupResult { wavesCreated: Int!, photosGrouped: Int! }`
