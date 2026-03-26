## MODIFIED Requirements

### Requirement: Database connections use ManagedServerlessClient wrapper
The system SHALL use a `ManagedServerlessClient` class (in `lambda-fns/psql.ts`) that wraps `serverless-postgres` to provide managed connection lifecycle, health checking, automatic reconnection, and operation serialization for Lambda-based database access. The singleton config SHALL explicitly map `user` from the `username` environment variable, because `pg.Client` expects `user` (not `username`). The client SHALL serialize all operations that touch `pg.Client`'s query protocol so that only one operation executes at a time, making the singleton safe for concurrent callers and pg@9-compatible. The client SHALL use `ssl: { ca: rdsCa, rejectUnauthorized: true }` where `rdsCa` is the AWS RDS global CA bundle imported as a string constant, replacing the previous `ssl: true` with global `NODE_TLS_REJECT_UNAUTHORIZED='0'` bypass.

#### Scenario: Module exports a singleton client
- **WHEN** any controller imports `psql` from `../../psql`
- **THEN** it SHALL receive a singleton `ManagedServerlessClient` instance configured with environment variables for host, port, database, user (mapped from username), password, and `PG_MAX_CONNECTIONS`

#### Scenario: Singleton maps username to user for pg compatibility
- **WHEN** the psql singleton is created
- **THEN** the config SHALL include `user: env.username` so that `pg.Client` receives the database user from the `username` environment variable

#### Scenario: Singleton uses explicit CA certificate for TLS
- **WHEN** the psql singleton is created
- **THEN** the config SHALL include `ssl: { ca: rdsCa, rejectUnauthorized: true }` where `rdsCa` is the imported RDS global CA bundle string, instead of `ssl: true`

#### Scenario: Concurrent queries are serialized
- **WHEN** multiple callers invoke `query()`, `connect()`, or `clean()` concurrently on the singleton
- **THEN** the client SHALL serialize these operations so that only one touches `pg.Client` at a time, preventing the pg@8 `DeprecationWarning` and ensuring pg@9 compatibility

#### Scenario: Error-retry stays serialized
- **WHEN** a query fails with a connection error and the client performs reconnection and retry
- **THEN** the entire retry sequence (reconnect, health check, retry query) SHALL execute within the same serialized slot, preventing other operations from hitting a dead connection

#### Scenario: Client restart resets the operation queue
- **WHEN** `restartClient()` creates a new `ServerlessClient` instance
- **THEN** the operation chain SHALL be reset so subsequent operations run against the new client
