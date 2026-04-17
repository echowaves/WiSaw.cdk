## MODIFIED Requirements

### Requirement: ManagedServerlessClient is the shared DB access layer
Controllers SHALL use the `psql` singleton from `lambda-fns/psql.ts` with connect/query/clean lifecycle. `connect()` SHALL prepare connectivity without executing a forced health-check query. Connection validation and recovery SHALL be driven by query execution and the existing query retry path.

#### Scenario: Controller query flow
- **WHEN** controller performs DB work
- **THEN** it calls connect -> one or more query operations -> clean

#### Scenario: Connect does not execute forced health-check query
- **WHEN** `psql.connect()` is invoked in a controller flow
- **THEN** the method SHALL ensure connectivity setup without running a forced `SELECT 1` health-check query

#### Scenario: Query path performs connection recovery
- **WHEN** a business query hits a recognized connection error
- **THEN** the query path SHALL restart the connection, validate the new connection, and retry the query once
