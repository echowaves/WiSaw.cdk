## ADDED Requirements

### Requirement: listWaves accepts optional sort parameters
The `listWaves` GraphQL query SHALL accept two optional `String` parameters: `sortBy` and `sortDirection`. When omitted, `sortBy` SHALL default to `"updatedAt"` and `sortDirection` SHALL default to `"desc"`.

#### Scenario: Default sort (no params provided)
- **WHEN** `listWaves` is called without `sortBy` or `sortDirection`
- **THEN** waves are returned sorted by `updatedAt DESC` (current behavior)

#### Scenario: Sort by createdAt ascending
- **WHEN** `listWaves` is called with `sortBy: "createdAt"` and `sortDirection: "asc"`
- **THEN** waves are returned sorted by `createdAt ASC` (oldest first)

#### Scenario: Sort by createdAt descending
- **WHEN** `listWaves` is called with `sortBy: "createdAt"` and `sortDirection: "desc"`
- **THEN** waves are returned sorted by `createdAt DESC` (newest first)

#### Scenario: Sort by updatedAt ascending
- **WHEN** `listWaves` is called with `sortBy: "updatedAt"` and `sortDirection: "asc"`
- **THEN** waves are returned sorted by `updatedAt ASC` (least recently updated first)

### Requirement: Invalid sort values are rejected
The controller SHALL validate `sortBy` and `sortDirection` against a whitelist of allowed values. Invalid values SHALL cause an error to be thrown.

#### Scenario: Invalid sortBy value
- **WHEN** `listWaves` is called with `sortBy: "name"`
- **THEN** the system throws an error "Invalid sort field"

#### Scenario: Invalid sortDirection value
- **WHEN** `listWaves` is called with `sortDirection: "random"`
- **THEN** the system throws an error "Invalid sort direction"

### Requirement: Sort parameters are safe from SQL injection
The controller SHALL construct the ORDER BY clause using a whitelist lookup, never by interpolating user input directly into the SQL query.

#### Scenario: SQL injection attempt in sortBy
- **WHEN** `listWaves` is called with `sortBy: "updatedAt\"; DROP TABLE \"Waves\"--"`
- **THEN** the system throws an error "Invalid sort field" and no SQL injection occurs
