## ADDED Requirements

### Requirement: UUID fields use assertValidUuid
Controllers validate `uuid`, `photoId`, and `waveUuid` via `assertValidUuid(value, fieldName)`.

#### Scenario: uuid accepted when structurally valid
- **WHEN** UUID string passes structural validation
- **THEN** controller continues to business logic

#### Scenario: uuid rejected when malformed
- **WHEN** value fails structural validation
- **THEN** controller throws `Wrong UUID format for <fieldName>: "<value>"`

### Requirement: UUID validation is structural and regex-free
`assertValidUuid` uses structural checks and throws `Wrong UUID format for <fieldName>: "<value>"` on failure.

#### Scenario: No regex dependency
- **WHEN** helper implementation is inspected
- **THEN** validation logic is based on char/position checks rather than regex

### Requirement: PATCH-style updates are null-safe
PATCH-like mutations treat both `null` and `undefined` as not provided (`!= null`) and preserve stored values.

#### Scenario: null optional field does not overwrite stored value
- **WHEN** patch payload includes `null` for optional field
- **THEN** field is treated as not provided

#### Scenario: undefined optional field does not overwrite stored value
- **WHEN** optional field is omitted/undefined
- **THEN** field remains unchanged

### Requirement: Numeric finite validation is controller-specific
There is no global numeric finite guard enforced across all numeric inputs; numeric checks are applied per controller implementation.

#### Scenario: Controller with dedicated numeric guard
- **WHEN** controller explicitly validates numeric input
- **THEN** invalid numeric values are rejected in that controller scope

#### Scenario: Controller without dedicated numeric guard
- **WHEN** controller does not implement finite-number checks
- **THEN** behavior remains implementation-defined for that path
