## ADDED Requirements

### Requirement: UUID fields use assertValidUuid
Controllers validate `uuid`, `photoId`, and `waveUuid` via `assertValidUuid(value, fieldName)`.

### Requirement: UUID validation is structural and regex-free
`assertValidUuid` uses structural checks and throws `Wrong UUID format for <fieldName>: "<value>"` on failure.

### Requirement: PATCH-style updates are null-safe
PATCH-like mutations treat both `null` and `undefined` as not provided (`!= null`) and preserve stored values.

### Requirement: Numeric finite validation is controller-specific
There is no global numeric finite guard enforced across all numeric inputs; numeric checks are applied per controller implementation.
