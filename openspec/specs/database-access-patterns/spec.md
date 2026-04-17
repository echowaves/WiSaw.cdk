## ADDED Requirements

### Requirement: ManagedServerlessClient is the shared DB access layer
Controllers SHALL use the `psql` singleton from `lambda-fns/psql.ts` with connect/query/clean lifecycle.

### Requirement: TLS verification uses bundled RDS CA
DB client SSL config SHALL use `{ ca: rdsCa, rejectUnauthorized: true }`.

### Requirement: Query parameters are parameterized for dynamic/user values
Dynamic values SHALL be passed via `$n` placeholders. Existing implementation may interpolate fixed numeric pagination constants in selected controllers; user-controlled values are still parameterized.

### Requirement: Query results are consumed from rows
Controllers SHALL consume query outputs via `.rows` and `.rows[0]`.

### Requirement: Connection cleanup is called after primary DB work
Controllers call `psql.clean()` after primary operations before returning.