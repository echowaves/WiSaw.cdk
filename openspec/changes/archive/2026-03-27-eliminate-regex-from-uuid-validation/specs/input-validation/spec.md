## MODIFIED Requirements

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
