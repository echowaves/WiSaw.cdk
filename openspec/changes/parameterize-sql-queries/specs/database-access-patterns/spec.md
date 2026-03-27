## MODIFIED Requirements

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
