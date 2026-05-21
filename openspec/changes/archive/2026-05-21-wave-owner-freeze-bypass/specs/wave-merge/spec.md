## MODIFIED Requirements

### Requirement: Merge two waves into one
The system SHALL provide a `mergeWaves` GraphQL mutation that merges a source wave into a target wave. The mutation SHALL accept `targetWaveUuid`, `sourceWaveUuid`, `uuid` (requesting user), and optional `name` and `description` fields. It SHALL return the updated target `Wave`. **Owners of both waves may merge regardless of freeze state.**

#### Scenario: Successful merge of two unfrozen waves
- **WHEN** user calls `mergeWaves` with valid targetWaveUuid, sourceWaveUuid, and uuid where the user is the owner of both waves and neither wave is frozen
- **THEN** all photos from the source wave are moved to the target wave, WaveUsers from the source are added to the target (without duplicates, preserving roles), the source wave is deleted, the target's photosCount is recalculated, and the merged target Wave is returned

#### Scenario: Owner merges frozen waves
- **WHEN** user calls `mergeWaves` where both waves are owned by the caller AND one or both waves are frozen
- **THEN** the merge proceeds normally without freeze restriction

### Requirement: Merge blocked if source wave owner differs from target owner
The system SHALL reject a merge when the requesting user is not the owner of either the source or target wave.

#### Scenario: Non-owner cannot initiate merge
- **WHEN** `mergeWaves` is called by a user who does not own both waves
- **THEN** the system SHALL throw an authorization error
