## MODIFIED Requirements

### Requirement: Connection health checking with configurable intervals
The `ManagedServerlessClient` SHALL perform health checks by executing `SELECT 1` on the database connection. The health check interval SHALL default to 30 seconds and be configurable via the `PG_HEALTH_CHECK_INTERVAL_MS` environment variable. The health check timeout SHALL default to 5 seconds and be configurable via `PG_HEALTH_CHECK_TIMEOUT_MS`.

#### Scenario: Health check on connect
- **WHEN** `psql.connect()` is called
- **THEN** the client SHALL ensure the connection is established and run a forced health check

#### Scenario: No health check on query
- **WHEN** `psql.query()` is called
- **THEN** the client SHALL NOT run a health check before executing the query (health checking is the responsibility of `connect()`)

#### Scenario: Health check on error-retry
- **WHEN** a query fails with a connection error and the client reconnects
- **THEN** the client SHALL run a forced health check on the new connection before retrying the query
