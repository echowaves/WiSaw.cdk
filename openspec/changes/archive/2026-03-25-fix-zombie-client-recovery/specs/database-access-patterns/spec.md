## MODIFIED Requirements

### Requirement: Connection concurrency guard is configurable
The `ManagedServerlessClient` SHALL read the maximum connection count from the `PG_MAX_CONNECTIONS` environment variable. If not set, it SHALL default to `80`. This value is passed to `serverless-postgres` as `maxConnections`, which controls when `clean()` starts killing idle connections (threshold = `maxConnections × connUtilization`).

#### Scenario: Default max connections
- **WHEN** `PG_MAX_CONNECTIONS` is not set
- **THEN** the client SHALL use `maxConnections: 80`

#### Scenario: Custom max connections
- **WHEN** `PG_MAX_CONNECTIONS` is set to a valid positive integer (e.g., `"40"`)
- **THEN** the client SHALL use that value as `maxConnections`

#### Scenario: Invalid max connections value
- **WHEN** `PG_MAX_CONNECTIONS` is set to a non-positive or non-numeric value
- **THEN** the client SHALL fall back to `80`

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

#### Scenario: Health check timeout triggers reconnection
- **WHEN** a health check times out (exceeds `PG_HEALTH_CHECK_TIMEOUT_MS`)
- **THEN** the client SHALL treat the timeout as a connection error, restart the client, and attempt reconnection

### Requirement: Environment sample documents all connection pool parameters
The `.env.sample` file SHALL include all environment variables that `ManagedServerlessClient` reads for connection tuning. It SHALL NOT include parameters that are not consumed by the client. Each parameter SHALL have an inline comment explaining its purpose and unit.

#### Scenario: Required parameters present
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL contain `PG_MAX_CONNECTIONS`, `PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, and `PG_CLIENT_DEBUG`

#### Scenario: Dead parameters removed
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL NOT contain `max`, `timeout`, `idle_timeout`, or `max_lifetime`

#### Scenario: PG_MAX_CONNECTIONS documents clean() threshold purpose
- **WHEN** a developer reviews `.env.sample`
- **THEN** the `PG_MAX_CONNECTIONS` comment SHALL explain it controls the `serverless-postgres` `clean()` threshold, not per-container connection count
