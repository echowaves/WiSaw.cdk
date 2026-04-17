## ADDED Requirements

### Requirement: Controllers are default async main functions
Controllers are default-exported async `main` functions, domain-organized, and invoked with positional args from dispatcher mapping.

### Requirement: DB lifecycle follows connect-query-clean
Controllers using DB call `psql.connect()`, perform parameterized `psql.query()`, then `psql.clean()`.

### Requirement: Model mapping uses plainToClass where model objects are returned
Controllers map DB rows to model classes with `plainToClass` when model serialization behavior is needed.

### Requirement: Timestamp format reflects implementation usage
Most create/update paths use `moment().format("YYYY-MM-DD HH:mm:ss.SSS")`; legacy exceptions can exist in specific controllers.

### Requirement: Side effects execute after primary mutation
Primary DB mutation runs first; counters/watchers/notifications are handled by helper side effects afterward.
