## ADDED Requirements

### Requirement: assertValidUuid shared helper
The system SHALL provide an `assertValidUuid(value, fieldName)` function in `lambda-fns/utilities/assertValidUuid.ts` that validates a string matches UUID format using structural character-by-character validation (length check, dash positions, hex character code ranges) without using regular expressions. If validation fails, it SHALL throw an `Error` with message `Wrong UUID format for <fieldName>: "<value>"`.

#### Scenario: Valid UUID passes silently
- **WHEN** `assertValidUuid("550e8400-e29b-41d4-a716-446655440000", "photoId")` is called
- **THEN** the function returns without throwing

#### Scenario: Invalid UUID throws with field name and value
- **WHEN** `assertValidUuid("1597", "photoId")` is called
- **THEN** the function throws `Error` with message `Wrong UUID format for photoId: "1597"`

#### Scenario: Empty string throws with value shown
- **WHEN** `assertValidUuid("", "uuid")` is called
- **THEN** the function throws `Error` with message `Wrong UUID format for uuid: ""`

#### Scenario: No regular expressions used
- **WHEN** the implementation of `assertValidUuid` is inspected
- **THEN** it SHALL contain no `RegExp` constructor calls, no regex literals (`/.../`), and no calls to `.test()`, `.match()`, or `.exec()`

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

### Requirement: Numeric argument validation
Controllers that accept numeric arguments (`lat`, `lon`, `daysAgo`, `pageNumber`) SHALL verify the values are finite numbers before use.

#### Scenario: Non-finite numeric value rejected
- **WHEN** a controller receives `NaN`, `Infinity`, or a non-numeric value for a numeric argument
- **THEN** the controller SHALL throw an error before executing any SQL query

### Requirement: Null-safe optional field handling in PATCH-style mutations
Controllers that implement PATCH-style updates (where optional fields may or may not be provided) SHALL use loose equality (`!= null`) to test whether a field was provided. Both `null` and `undefined` SHALL be treated as "field not provided" and the existing database value SHALL be preserved.

#### Scenario: Undefined field is not updated
- **WHEN** an optional field is `undefined` in the resolver arguments
- **THEN** the field SHALL NOT be included in the SQL UPDATE SET clause

#### Scenario: Null field is not updated
- **WHEN** an optional field is `null` in the resolver arguments (e.g., from an undeclared GraphQL variable)
- **THEN** the field SHALL NOT be included in the SQL UPDATE SET clause
