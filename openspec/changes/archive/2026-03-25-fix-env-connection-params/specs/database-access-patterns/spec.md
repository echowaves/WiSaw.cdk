## ADDED Requirements

### Requirement: Connection concurrency guard is configurable
The `ManagedServerlessClient` SHALL read the maximum connection count from the `PG_MAX_CONNECTIONS` environment variable. If not set, it SHALL default to `20`. This value is passed to `serverless-postgres` as `maxConnections`, which checks `pg_stat_activity` and refuses new connections when total connections reach this threshold.

#### Scenario: Default max connections
- **WHEN** `PG_MAX_CONNECTIONS` is not set
- **THEN** the client SHALL use `maxConnections: 20`

#### Scenario: Custom max connections
- **WHEN** `PG_MAX_CONNECTIONS` is set to a valid positive integer (e.g., `"40"`)
- **THEN** the client SHALL use that value as `maxConnections`

#### Scenario: Invalid max connections value
- **WHEN** `PG_MAX_CONNECTIONS` is set to a non-positive or non-numeric value
- **THEN** the client SHALL fall back to `20`

### Requirement: Environment sample documents all connection pool parameters
The `.env.sample` file SHALL include all environment variables that `ManagedServerlessClient` reads for connection tuning. It SHALL NOT include parameters that are not consumed by the client. Each parameter SHALL have an inline comment explaining its purpose and unit.

#### Scenario: Required parameters present
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL contain `PG_MAX_CONNECTIONS`, `PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, and `PG_CLIENT_DEBUG`

#### Scenario: Dead parameters removed
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL NOT contain `max`, `timeout`, `idle_timeout`, or `max_lifetime`

## MODIFIED Requirements

### Requirement: Database connections use ManagedServerlessClient wrapper
The system SHALL use a `ManagedServerlessClient` class (in `lambda-fns/psql.ts`) that wraps `serverless-postgres` to provide managed connection lifecycle, health checking, and automatic reconnection for Lambda-based database access.

#### Scenario: Module exports a singleton client
- **WHEN** any controller imports `psql` from `../../psql`
- **THEN** it SHALL receive a singleton `ManagedServerlessClient` instance configured with environment variables for host, port, database, username, password, and `PG_MAX_CONNECTIONS`
