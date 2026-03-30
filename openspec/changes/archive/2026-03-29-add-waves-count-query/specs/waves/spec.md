## ADDED Requirements

### Requirement: Waves count query
The system SHALL provide a `getWavesCount(uuid)` query that returns the total number of waves the given device UUID belongs to. The controller SHALL validate the device `uuid` format using `assertValidUuid` before any database access and SHALL use parameterized SQL.

#### Scenario: User belongs to waves
- **WHEN** `getWavesCount(uuid)` is called with a valid UUID that belongs to 3 waves
- **THEN** the response SHALL be `3`

#### Scenario: User belongs to no waves
- **WHEN** `getWavesCount(uuid)` is called with a valid UUID that belongs to no waves
- **THEN** the response SHALL be `0`

#### Scenario: Invalid UUID rejected
- **WHEN** `getWavesCount(uuid)` is called with an invalid UUID format
- **THEN** the controller SHALL throw `Wrong UUID format for uuid: "<value>"` before executing any SQL query
