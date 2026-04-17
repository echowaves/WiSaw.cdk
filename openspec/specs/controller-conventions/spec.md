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
Most create/update paths use `moment().format("YYYY-MM-DD HH:mm:ss.SSS")`; legacy exceptions can exist in specific controllers.

#### Scenario: Standard timestamp precision path
- **WHEN** controller follows current convention
- **THEN** timestamps are generated with millisecond precision format

#### Scenario: Legacy timestamp exception path
- **WHEN** specific controller retains historical format
- **THEN** behavior is documented as an implementation exception

### Requirement: Side effects execute after primary mutation
Primary DB mutation runs first; counters/watchers/notifications are handled by helper side effects afterward.

#### Scenario: Comment create side effects
- **WHEN** comment insert succeeds
- **THEN** counters and watcher-related helpers run after primary write
