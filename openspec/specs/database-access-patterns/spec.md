## ADDED Requirements

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

### Requirement: Connection lifetime rotation
The client SHALL rotate (close and reopen) database connections that exceed a maximum lifetime. The default maximum lifetime SHALL be 10 minutes and SHALL be configurable via the `PG_CONNECTION_MAX_LIFETIME_MS` environment variable.

#### Scenario: Connection exceeds maximum lifetime
- **WHEN** a connection has been open longer than `maxLifetimeMs`
- **THEN** the client SHALL close the existing connection and create a new one before proceeding

### Requirement: Automatic reconnection on connection errors
The client SHALL detect connection errors by matching PostgreSQL error codes (e.g., `57P01`, `08006`, `53300`) and error message patterns (e.g., "connection terminated unexpectedly", "too many clients"). On connection error, the client SHALL restart the connection and retry the failed query exactly once.

#### Scenario: Connection lost during query
- **WHEN** a query fails with a connection error code or matching error message pattern
- **THEN** the client SHALL close the failing connection, establish a new connection, run a forced health check, and retry the query once

#### Scenario: Non-connection error during query
- **WHEN** a query fails with an error that does not match any connection error code or pattern
- **THEN** the client SHALL propagate the error without retry

### Requirement: All queries use parameterized SQL
All database queries SHALL use parameterized SQL via `psql.query(queryText, values)` where `queryText` contains `$1`, `$2`, etc. placeholders and `values` is a readonly array of parameters. Direct string concatenation or template literal interpolation of ANY value into SQL is NOT permitted, including numeric values for LIMIT, OFFSET, and PostGIS function arguments.

#### Scenario: Parameterized insert
- **WHEN** a controller inserts a row
- **THEN** it SHALL use `psql.query('INSERT INTO "Table" ("col") VALUES ($1)', [value])`

#### Scenario: Parameterized WHERE clause with string value
- **WHEN** a controller filters by a string column (e.g., `uuid`, `photoId`)
- **THEN** it SHALL use `psql.query('SELECT ... WHERE "uuid" = $1', [uuid])` — never `WHERE "uuid" = '${uuid}'`

#### Scenario: Parameterized LIMIT and OFFSET
- **WHEN** a controller uses pagination
- **THEN** it SHALL use `psql.query('SELECT ... LIMIT $1 OFFSET $2', [limit, offset])` — never `LIMIT ${limit}`

#### Scenario: Parameterized PostGIS function arguments
- **WHEN** a controller uses `ST_MakePoint` or `ST_Distance`
- **THEN** coordinates SHALL be passed as parameters: `psql.query('ST_MakePoint($1, $2)', [lon, lat])` — never `ST_MakePoint(${lon}, ${lat})`

#### Scenario: Parameterized full-text search
- **WHEN** a controller uses `plainto_tsquery`
- **THEN** the search term SHALL be passed as a parameter: `psql.query("plainto_tsquery('English', $1)", [searchTerm])` — never interpolated

### Requirement: PostGIS extension for geo-spatial queries
The system SHALL use the PostGIS extension for all geo-spatial operations. Location data SHALL be stored as PostGIS geometry points created with `ST_MakePoint(longitude, latitude)`. Distance calculations SHALL use `ST_Distance(point1, point2)`.

#### Scenario: Storing a location
- **WHEN** a record with geo-location is inserted
- **THEN** the SQL SHALL use `ST_MakePoint($longitude, $latitude)` for the location column

#### Scenario: Querying by distance
- **WHEN** records are queried by proximity to a point
- **THEN** the SQL SHALL use `ST_Distance(location, ST_MakePoint($lon, $lat))` for distance calculation and ordering

### Requirement: Table and column names use double-quoted PascalCase
All SQL queries SHALL reference table names in double-quoted PascalCase (e.g., `"Photos"`, `"Comments"`, `"AbuseReports"`) and column names in double-quoted camelCase (e.g., `"createdAt"`, `"photoId"`, `"commentsCount"`). This matches the PostgreSQL schema created by Sequelize migrations.

#### Scenario: Referencing a table in a query
- **WHEN** a SQL query references the photos table
- **THEN** it SHALL use `"Photos"` (double-quoted, PascalCase)

#### Scenario: Referencing a column in a query
- **WHEN** a SQL query references the created-at timestamp column
- **THEN** it SHALL use `"createdAt"` (double-quoted, camelCase)

### Requirement: Query results accessed via rows property
Database query results SHALL be accessed via the `.rows` property of the `QueryResult` object returned by `psql.query()`. Single-row results SHALL use `.rows[0]`. Multi-row results SHALL use `.rows` directly.

#### Scenario: Single row result
- **WHEN** a controller expects one row (e.g., INSERT RETURNING *)
- **THEN** it SHALL access the result as `(await psql.query(...)).rows[0]`

#### Scenario: Multi-row result
- **WHEN** a controller expects multiple rows (e.g., SELECT with pagination)
- **THEN** it SHALL access the result as `(await psql.query(...)).rows`

### Requirement: Clean releases the connection after use
After completing the primary query operations, controllers SHALL call `psql.clean()` to release the connection back to the serverless-postgres connection pool. This allows the connection to be reused by subsequent Lambda invocations.

#### Scenario: Connection cleanup after insert
- **WHEN** a controller finishes its primary insert query
- **THEN** it SHALL call `await psql.clean()` before proceeding with side effects or returning
