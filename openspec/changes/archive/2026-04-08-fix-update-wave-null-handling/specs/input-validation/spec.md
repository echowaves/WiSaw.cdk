## ADDED Requirements

### Requirement: Null-safe optional field handling in PATCH-style mutations
Controllers that implement PATCH-style updates (where optional fields may or may not be provided) SHALL use loose equality (`!= null`) to test whether a field was provided. Both `null` and `undefined` SHALL be treated as "field not provided" and the existing database value SHALL be preserved.

#### Scenario: Undefined field is not updated
- **WHEN** an optional field is `undefined` in the resolver arguments
- **THEN** the field SHALL NOT be included in the SQL UPDATE SET clause

#### Scenario: Null field is not updated
- **WHEN** an optional field is `null` in the resolver arguments (e.g., from an undeclared GraphQL variable)
- **THEN** the field SHALL NOT be included in the SQL UPDATE SET clause
