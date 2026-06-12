## ADDED Requirements

### Requirement: Controllers are default async main functions
Controllers are default-exported async `main` functions, domain-organized, and invoked with positional args from dispatcher mapping.

#### Scenario: Domain-organized controller file
- **WHEN** adding photo domain operation
- **THEN** controller resides under `controllers/photos` as default async `main`

### Requirement: DB lifecycle follows connect-query-clean
Controllers using DB call `psql.connect()`, perform parameterized `psql.query()`, then `psql.clean()`.

#### Scenario: Query-only controller flow
- **WHEN** controller reads data
- **THEN** it still follows connect -> query -> clean lifecycle

### Requirement: Model mapping uses plainToClass where model objects are returned
Controllers map DB rows to model classes with `plainToClass` when model serialization behavior is needed.

#### Scenario: Model serialization path
- **WHEN** controller returns photo model
- **THEN** plainToClass mapping preserves model serialization behavior

### Requirement: Timestamp format reflects implementation usage
All create/update paths use `dayjs().toISOString()` to produce valid ISO 8601 `AWSDateTime` strings.

#### Scenario: Standard timestamp precision path
- **WHEN** controller creates or updates a record
- **THEN** timestamp is generated with `dayjs().toISOString()` producing valid ISO 8601 format (e.g. `"2026-06-12T02:43:30.793Z"`)

### Requirement: Side effects execute after primary mutation
Primary DB mutation runs first; counters/watchers/notifications are handled by helper side effects afterward.

#### Scenario: Comment create side effects
- **WHEN** comment insert succeeds
- **THEN** counters and watcher-related helpers run after primary write
