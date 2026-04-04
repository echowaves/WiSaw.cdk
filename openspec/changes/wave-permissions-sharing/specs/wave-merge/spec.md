## MODIFIED Requirements

### Requirement: Merge two waves into one
The system SHALL provide a `mergeWaves` GraphQL mutation that merges a source wave into a target wave. Both the source and target waves MUST NOT be frozen. The mutation SHALL accept `targetWaveUuid`, `sourceWaveUuid`, `uuid` (requesting user), and optional `name` and `description` fields. It SHALL return the updated target `Wave`.

#### Scenario: Successful merge of two waves
- **WHEN** user calls `mergeWaves` with valid targetWaveUuid, sourceWaveUuid, and uuid where the user is the owner of both waves and neither wave is frozen
- **THEN** all photos from the source wave are moved to the target wave, WaveUsers from the source are added to the target (without duplicates, preserving roles), the source wave is deleted, the target's photosCount is recalculated, and the merged target Wave is returned

#### Scenario: Merge blocked if target wave is frozen
- **WHEN** `mergeWaves` is called and the target wave is frozen
- **THEN** the system SHALL throw an error indicating frozen waves cannot be merged

#### Scenario: Merge blocked if source wave is frozen
- **WHEN** `mergeWaves` is called and the source wave is frozen
- **THEN** the system SHALL throw an error indicating frozen waves cannot be merged

### Requirement: Authorization requires ownership of both waves
The system SHALL verify that the requesting user (`uuid`) has `role = 'owner'` in `WaveUsers` for both the target and source waves before performing the merge.

#### Scenario: User owns both waves
- **WHEN** user has `role = 'owner'` in `WaveUsers` for both target and source waves
- **THEN** the merge proceeds

#### Scenario: User does not own the target wave
- **WHEN** user does not have `role = 'owner'` in `WaveUsers` for the target wave
- **THEN** the system throws an error and no changes are made

#### Scenario: User does not own the source wave
- **WHEN** user does not have `role = 'owner'` in `WaveUsers` for the source wave
- **THEN** the system throws an error and no changes are made
