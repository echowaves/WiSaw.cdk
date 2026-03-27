## ADDED Requirements

### Requirement: assertValidUuid shared helper
The system SHALL provide an `assertValidUuid(value, fieldName)` function in `lambda-fns/utilities/assertValidUuid.ts` that validates a string matches UUID format using a case-insensitive regex. If validation fails, it SHALL throw an `Error` with message `Wrong UUID format for <fieldName>: "<value>"`.

#### Scenario: Valid UUID passes silently
- **WHEN** `assertValidUuid("550e8400-e29b-41d4-a716-446655440000", "photoId")` is called
- **THEN** the function returns without throwing

#### Scenario: Invalid UUID throws with field name and value
- **WHEN** `assertValidUuid("1597", "photoId")` is called
- **THEN** the function throws `Error` with message `Wrong UUID format for photoId: "1597"`

#### Scenario: Empty string throws with value shown
- **WHEN** `assertValidUuid("", "uuid")` is called
- **THEN** the function throws `Error` with message `Wrong UUID format for uuid: ""`

## MODIFIED Requirements

### Requirement: Device uuid validation
Every controller that accepts a device `uuid` argument SHALL validate the value using `assertValidUuid(uuid, 'uuid')` before any database access. If the value does not match UUID format, the error message SHALL include both the field name and the rejected value.

#### Scenario: Valid device uuid accepted
- **WHEN** a controller receives a `uuid` argument in valid UUID format (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)
- **THEN** processing continues normally

#### Scenario: Invalid device uuid rejected
- **WHEN** a controller receives a `uuid` argument that is not valid UUID format (e.g., `"0"`, `""`, `"not-a-uuid"`)
- **THEN** the controller SHALL throw an error with message `Wrong UUID format for uuid: "<value>"` before executing any SQL query

### Requirement: Photo ID validation
Every controller that accepts a `photoId` argument SHALL validate the value using `assertValidUuid(photoId, 'photoId')` before any database access. If the value does not match UUID format, the error message SHALL include both the field name and the rejected value.

#### Scenario: Valid photoId accepted
- **WHEN** a controller receives a `photoId` in valid UUID format
- **THEN** processing continues normally

#### Scenario: Invalid photoId rejected
- **WHEN** a controller receives a `photoId` that is not valid UUID format (e.g., `"1597"`, `"abc"`)
- **THEN** the controller SHALL throw an error with message `Wrong UUID format for photoId: "<value>"` before executing any SQL query

### Requirement: Wave UUID validation
Every controller that accepts a `waveUuid` argument SHALL validate the value using `assertValidUuid(waveUuid, 'waveUuid')` before any database access.

#### Scenario: Invalid waveUuid rejected
- **WHEN** a controller receives a `waveUuid` that is not valid UUID format
- **THEN** the controller SHALL throw an error with message `Wrong UUID format for waveUuid: "<value>"` before executing any SQL query

## REMOVED Requirements

### Requirement: isValidDeviceUuid utility
**Reason**: Replaced by `assertValidUuid` shared helper which validates and throws in a single call with standardized error messages.
**Migration**: Replace `import { isValidDeviceUuid }` with `import { assertValidUuid }` from `../../utilities/assertValidUuid`. Replace `if (!isValidDeviceUuid(uuid)) { throw ... }` with `assertValidUuid(uuid, 'uuid')`.
