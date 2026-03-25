## MODIFIED Requirements

### Requirement: Database connections use ManagedServerlessClient wrapper
The system SHALL use a `ManagedServerlessClient` class (in `lambda-fns/psql.ts`) that wraps `serverless-postgres` to provide managed connection lifecycle, health checking, and automatic reconnection for Lambda-based database access. The singleton config SHALL explicitly map `user` from the `username` environment variable, because `pg.Client` expects `user` (not `username`).

#### Scenario: Module exports a singleton client
- **WHEN** any controller imports `psql` from `../../psql`
- **THEN** it SHALL receive a singleton `ManagedServerlessClient` instance configured with environment variables for host, port, database, user (mapped from username), password, and `PG_MAX_CONNECTIONS`

#### Scenario: Singleton maps username to user for pg compatibility
- **WHEN** the psql singleton is created
- **THEN** the config SHALL include `user: env.username` so that `pg.Client` receives the database user from the `username` environment variable

### Requirement: Environment sample documents all connection pool parameters
The `.env.sample` file SHALL include all environment variables that `ManagedServerlessClient` reads for connection tuning. It SHALL NOT include parameters that are not consumed by the client. Each parameter SHALL have an inline comment explaining its purpose and unit. The `.env.*` files SHALL retain `username` for Sequelize migration compatibility (`config/config.js`).

#### Scenario: Required parameters present
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL contain `username`, `PG_MAX_CONNECTIONS`, `PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, and `PG_CLIENT_DEBUG`

#### Scenario: Dead parameters removed
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL NOT contain `max`, `timeout`, `idle_timeout`, or `max_lifetime`

#### Scenario: PG_MAX_CONNECTIONS documents clean() threshold purpose
- **WHEN** a developer reviews `.env.sample`
- **THEN** the `PG_MAX_CONNECTIONS` comment SHALL explain it controls the `serverless-postgres` `clean()` threshold, not per-container connection count

#### Scenario: username field has pg compatibility comment
- **WHEN** a developer reviews `.env.sample`
- **THEN** the `username` field SHALL have a comment noting that `psql.ts` maps it to `user` for pg driver compatibility
