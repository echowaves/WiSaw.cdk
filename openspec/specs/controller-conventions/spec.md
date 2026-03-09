## ADDED Requirements

### Requirement: Controllers are async functions with typed positional arguments
Each controller SHALL be a default-exported async function named `main` that accepts positional arguments matching the GraphQL operation's parameters. Arguments SHALL NOT use a single options object; they SHALL be individual typed parameters.

#### Scenario: Controller function signature
- **WHEN** a controller is created for a mutation with arguments `photoId`, `uuid`, and `description`
- **THEN** the function signature SHALL be `async function main(photoId: string, uuid: string, description: string)`

#### Scenario: Controller default export
- **WHEN** a controller file is created
- **THEN** the function SHALL be exported as the default export (`export default async function main(...)`)

### Requirement: Database connection lifecycle follows connect-query-clean pattern
Each controller that accesses the database SHALL call `psql.connect()` before any queries, execute queries via `psql.query()`, and call `psql.clean()` after the primary query completes to release the connection back to the pool.

#### Scenario: Mutation controller with database access
- **WHEN** a controller performs a database insert
- **THEN** it SHALL call `await psql.connect()` at the start, execute the insert via `await psql.query(...)`, and call `await psql.clean()` after obtaining the result

#### Scenario: Query controller with database access
- **WHEN** a controller performs a database select
- **THEN** it SHALL follow the same connect-query-clean lifecycle

### Requirement: SQL queries use parameterized statements
All SQL queries SHALL use parameterized queries with `$1`, `$2`, etc. placeholders and pass values as an array to `psql.query(queryText, values)`. Raw string interpolation of user-provided values into SQL strings is NOT permitted.

#### Scenario: Insert with parameters
- **WHEN** a controller inserts a record with user-provided values
- **THEN** the query SHALL use `$N` placeholders and pass values as `[value1, value2, ...]`

### Requirement: Model instances are created using plainToClass
Controllers that return typed model objects SHALL use `plainToClass(ModelClass, dbRow)` from the `class-transformer` library to convert raw database rows into model class instances. This enables custom serialization via `toJSON()`.

#### Scenario: Returning a Photo from a mutation
- **WHEN** a controller creates or retrieves a Photo record
- **THEN** it SHALL return `plainToClass(Photo, row)` where `row` is the database query result

### Requirement: Timestamps use moment.js with millisecond precision format
Controllers that generate timestamps SHALL use `moment().format("YYYY-MM-DD HH:mm:ss.SSS")` to produce timestamp strings for `createdAt` and `updatedAt` fields.

#### Scenario: Creating a new record with timestamps
- **WHEN** a controller inserts a new record
- **THEN** it SHALL generate `createdAt` and `updatedAt` using `moment().format("YYYY-MM-DD HH:mm:ss.SSS")` and set both to the same value

### Requirement: UUIDs are generated with uuid v4
Controllers that create new entities with UUID primary keys SHALL use `uuidv4()` from the `uuid` library to generate the identifier.

#### Scenario: Creating a new photo
- **WHEN** a controller creates a new photo record
- **THEN** it SHALL generate the photo's `id` using `const photoId = uuidv4()`

### Requirement: Input validation is performed inline in controllers
Validation logic (e.g., empty string checks, abuse count thresholds) SHALL be performed directly within controller functions, not in a shared middleware or validation layer. Validation failures SHALL throw string error messages.

#### Scenario: Empty comment rejected
- **WHEN** a controller receives an empty description for a comment
- **THEN** it SHALL throw `"Unable to save empty comment."` before any database operations

#### Scenario: Banned user rejected
- **WHEN** a controller detects more than 3 abuse reports for a user's photos
- **THEN** it SHALL throw `"You are banned"` and not proceed with the operation

### Requirement: Controller files are organized by domain under controllers directory
Each controller file SHALL reside in `lambda-fns/controllers/<domain>/` where `<domain>` is the plural form of the entity (e.g., `photos`, `comments`, `waves`, `friendships`, `messages`, `secrets`, `abuseReports`, `contactForms`).

#### Scenario: CRUD operation file naming
- **WHEN** a create controller is added for a domain
- **THEN** it SHALL be placed at `lambda-fns/controllers/<domain>/create.ts`

#### Scenario: Helper function file naming
- **WHEN** a private helper function is created for a domain
- **THEN** it SHALL be prefixed with an underscore and placed in the same domain directory (e.g., `_updateCommentsCount.ts`)

### Requirement: Side effects are composed after the primary operation
Controllers that trigger side effects (e.g., updating counters, notifying watchers, auto-watching) SHALL execute the primary database operation first, then compose side effects. Independent side effects MAY be parallelized with `Promise.all()`, but operations that share database connections or have ordering dependencies SHALL be executed sequentially.

#### Scenario: Creating a comment triggers side effects
- **WHEN** a comment is created
- **THEN** the controller SHALL first insert the comment, then sequentially update the comments count, then parallelize the last-comment update, watch operation, and watcher notification

### Requirement: PostGIS functions are used for geo-location operations
Controllers dealing with location data SHALL use PostGIS SQL functions: `ST_MakePoint(longitude, latitude)` for creating points and `ST_Distance()` for distance calculations. Note that PostGIS expects longitude before latitude in `ST_MakePoint`.

#### Scenario: Creating a geo-located record
- **WHEN** a controller inserts a record with location data
- **THEN** it SHALL use `ST_MakePoint($lon, $lat)` in the SQL INSERT statement with longitude as the first parameter
