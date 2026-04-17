## ADDED Requirements

### Requirement: ManagedServerlessClient is the shared DB access layer
Controllers SHALL use the `psql` singleton from `lambda-fns/psql.ts` with connect/query/clean lifecycle.

#### Scenario: Controller query flow
- **WHEN** controller performs DB work
- **THEN** it calls connect -> one or more query operations -> clean

### Requirement: TLS verification uses bundled RDS CA
DB client SSL config SHALL use `{ ca: rdsCa, rejectUnauthorized: true }`.

#### Scenario: TLS verification enabled for lambda DB connections
- **WHEN** psql singleton initializes
- **THEN** ssl config includes CA bundle and `rejectUnauthorized=true`

### Requirement: Query parameters are parameterized for dynamic/user values
Dynamic values SHALL be passed via `$n` placeholders. Existing implementation may interpolate fixed numeric pagination constants in selected controllers; user-controlled values are still parameterized.

#### Scenario: User-Supplied UUID Is Parameterized
- **WHEN** query filters by uuid/photoId/waveUuid
- **THEN** SQL uses placeholders with values array

#### Scenario: Fixed Numeric Pagination Constant Interpolation
- **WHEN** controller uses fixed/sanitized pagination constant interpolation in current implementation
- **THEN** behavior remains accepted by this spec while preserving user-input parameterization rule

### Requirement: Query results are consumed from rows
Controllers SHALL consume query outputs via `.rows` and `.rows[0]`.

#### Scenario: Single-Row Fetch
- **WHEN** query expects one row
- **THEN** controller reads `.rows[0]`

### Requirement: Connection cleanup is called after primary DB work
Controllers call `psql.clean()` after primary operations before returning.

#### Scenario: Cleanup executes before return
- **WHEN** main DB operation completes
- **THEN** controller performs cleanup before final response