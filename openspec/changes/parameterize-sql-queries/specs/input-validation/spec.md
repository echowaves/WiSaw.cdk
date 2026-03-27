## ADDED Requirements

### Requirement: Device uuid validation
Every controller that accepts a device `uuid` argument SHALL validate the value using `isValidDeviceUuid()` before any database access. If the value does not match UUID v4 format, the controller SHALL throw an error with a descriptive message including the invalid value.

#### Scenario: Valid device uuid accepted
- **WHEN** a controller receives a `uuid` argument in valid UUID format (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)
- **THEN** processing continues normally

#### Scenario: Invalid device uuid rejected
- **WHEN** a controller receives a `uuid` argument that is not valid UUID format (e.g., `"0"`, `""`, `"not-a-uuid"`)
- **THEN** the controller SHALL throw an error before executing any SQL query

### Requirement: Photo ID validation
Every controller that accepts a `photoId` argument SHALL validate the value using `isValidPhotoId()` before any database access. If the value does not match UUID format, the controller SHALL throw an error.

#### Scenario: Valid photoId accepted
- **WHEN** a controller receives a `photoId` in valid UUID format
- **THEN** processing continues normally

#### Scenario: Invalid photoId rejected
- **WHEN** a controller receives a `photoId` that is not valid UUID format (e.g., `"1597"`, `"abc"`)
- **THEN** the controller SHALL throw an error before executing any SQL query

### Requirement: Wave UUID validation
Every controller that accepts a `waveUuid` argument SHALL validate the value using `uuidValidate()` from the `uuid` library before any database access.

#### Scenario: Invalid waveUuid rejected
- **WHEN** a controller receives a `waveUuid` that is not valid UUID format
- **THEN** the controller SHALL throw an error before executing any SQL query

### Requirement: Numeric argument validation
Controllers that accept numeric arguments (`lat`, `lon`, `daysAgo`, `pageNumber`) SHALL verify the values are finite numbers before use.

#### Scenario: Non-finite numeric value rejected
- **WHEN** a controller receives `NaN`, `Infinity`, or a non-numeric value for a numeric argument
- **THEN** the controller SHALL throw an error before executing any SQL query

### Requirement: isValidDeviceUuid utility
The system SHALL provide an `isValidDeviceUuid()` function in `lambda-fns/utilities/isValidDeviceUuid.ts` that validates a string matches UUID v4 format using a case-insensitive regex, parallel to the existing `isValidPhotoId()` utility.

#### Scenario: UUID format validation
- **WHEN** `isValidDeviceUuid("550e8400-e29b-41d4-a716-446655440000")` is called
- **THEN** it SHALL return `true`

#### Scenario: Non-UUID format rejected
- **WHEN** `isValidDeviceUuid("0")` is called
- **THEN** it SHALL return `false`
