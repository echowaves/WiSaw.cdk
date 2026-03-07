## ADDED Requirements

### Requirement: Database connections use ManagedServerlessClient wrapper
The system SHALL use a `ManagedServerlessClient` class (in `lambda-fns/psql.ts`) that wraps `serverless-postgres` to provide managed connection lifecycle, health checking, and automatic reconnection for Lambda-based database access.

#### Scenario: Module exports a singleton client
- **WHEN** any controller imports `psql` from `../../psql`
- **THEN** it SHALL receive a singleton `ManagedServerlessClient` instance configured with environment variables for host, port, database, username, and password

### Requirement: Connection health checking with configurable intervals
The `ManagedServerlessClient` SHALL perform periodic health checks by executing `SELECT 1` on the database connection. The health check interval SHALL default to 30 seconds and be configurable via the `PG_HEALTH_CHECK_INTERVAL_MS` environment variable. The health check timeout SHALL default to 5 seconds and be configurable via `PG_HEALTH_CHECK_TIMEOUT_MS`.

#### Scenario: Health check on connect
- **WHEN** `psql.connect()` is called
- **THEN** the client SHALL ensure the connection is established and run a forced health check

#### Scenario: Health check on query
- **WHEN** `psql.query()` is called and the health check interval has elapsed
- **THEN** the client SHALL run a health check before executing the query

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
All database queries SHALL use parameterized SQL via `psql.query(queryText, values)` where `queryText` contains `$1`, `$2`, etc. placeholders and `values` is a readonly array of parameters. Direct string concatenation of user input into SQL is NOT permitted.

#### Scenario: Parameterized insert
- **WHEN** a controller inserts a row
- **THEN** it SHALL use `psql.query('INSERT INTO "Table" ("col") VALUES ($1)', [value])`

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
