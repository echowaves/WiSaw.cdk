### Requirement: Fetch a single wave by UUID
The system SHALL expose a `getWave` GraphQL query that accepts a `waveUuid` argument and the caller's `uuid`, and returns the corresponding `Wave` object. The query SHALL NOT perform any writes or side effects.

#### Scenario: Wave exists and caller is a member
- **WHEN** caller provides a valid `waveUuid` for an existing wave and the caller is a member of that wave
- **THEN** the system returns the Wave with `myRole` set to the caller's role, `isFrozen` computed from splash/freeze dates, up to 5 recent active photos, and `joinUrl` populated if the wave is open

#### Scenario: Wave exists and caller is not a member
- **WHEN** caller provides a valid `waveUuid` for an existing wave but the caller is not a member
- **THEN** the system returns the Wave with `myRole` set to `null`, `isFrozen` computed, photos included, and `joinUrl` populated if the wave is open

#### Scenario: Wave does not exist
- **WHEN** caller provides a `waveUuid` that does not match any wave
- **THEN** the system returns `null`

#### Scenario: Invalid UUID format
- **WHEN** caller provides a `waveUuid` that is not a valid UUID
- **THEN** the system throws a validation error
