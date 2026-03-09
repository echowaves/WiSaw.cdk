## ADDED Requirements

### Requirement: Migration files use timestamp-prefixed kebab-case naming
Migration files SHALL be named `YYYYMMDDHHmmss-kebab-case-description.js` where the timestamp represents the creation time and the description summarizes the change. The description SHALL start with an action verb (`create-`, `add-`, `remove-`, `rename-`, `populate-`, `replace-`).

#### Scenario: Creating a new table migration
- **WHEN** a migration creates the `Waves` table
- **THEN** the file SHALL be named like `20251124000000-create-waves.js`

#### Scenario: Adding a column migration
- **WHEN** a migration adds a `radius` column to `Waves`
- **THEN** the file SHALL be named like `20251230000000-add-wave-location-radius.js`

#### Scenario: Data migration naming
- **WHEN** a migration populates UUID columns with computed values
- **THEN** the file SHALL be named like `20250718120001-populate-photo-uuid-columns.js`

### Requirement: Migrations use async/await syntax
All new migrations SHALL use `async/await` with the `module.exports` pattern. Promise chains and `.then()` syntax SHALL NOT be used in new migrations.

#### Scenario: Standard migration structure
- **WHEN** a new migration file is created
- **THEN** it SHALL follow this structure:
  ```javascript
  'use strict'
  module.exports = {
    up: async (queryInterface, Sequelize) => {
      // migration logic
    },
    down: async (queryInterface, Sequelize) => {
      // reversal logic
    },
  }
  ```

#### Scenario: Migration with multiple steps
- **WHEN** a migration performs multiple operations (e.g., add column then add index)
- **THEN** each operation SHALL be `await`-ed sequentially within the async function

### Requirement: Every migration implements a reversible down method
All migrations SHALL implement a `down()` method that fully reverses the `up()` method. For irreversible data migrations, `down()` SHALL throw an error with a descriptive message explaining why reversal is not possible.

#### Scenario: Schema migration reversal
- **WHEN** `up()` adds a column with `addColumn('Photos', 'likes', ...)`
- **THEN** `down()` SHALL remove it with `removeColumn('Photos', 'likes')`

#### Scenario: Table creation reversal
- **WHEN** `up()` creates a table with `createTable('Waves', ...)`
- **THEN** `down()` SHALL drop it with `dropTable('Waves')`

#### Scenario: Irreversible data migration
- **WHEN** a migration performs an irreversible operation (e.g., S3 object renames)
- **THEN** `down()` SHALL throw: `throw new Error('Migration is irreversible: <reason>')`

#### Scenario: Multi-step reversal ordering
- **WHEN** `up()` performs steps A → B → C
- **THEN** `down()` SHALL reverse them in order C → B → A

### Requirement: Table names use PascalCase plural form
Table names in migrations SHALL be PascalCase and plural (e.g., `Photos`, `AbuseReports`, `ChatUsers`, `WavePhotos`). Table names SHALL be passed as string literals to queryInterface methods.

#### Scenario: Creating a new table
- **WHEN** a migration creates a table for the `wave` entity
- **THEN** it SHALL use `queryInterface.createTable('Waves', { ... })`

#### Scenario: Join table naming
- **WHEN** a migration creates a join table between `Wave` and `Photo`
- **THEN** it SHALL be named `WavePhotos` (both entity names PascalCase, second entity plural)

### Requirement: Column names use camelCase
Column names in migrations SHALL be camelCase (e.g., `commentsCount`, `photoUuid`, `watchedAt`, `deactivatedBy`). Standard timestamp columns SHALL be named `createdAt` and `updatedAt`.

#### Scenario: Adding a count column
- **WHEN** a migration adds a count tracker to the `Photos` table
- **THEN** the column SHALL be named in camelCase: `commentsCount`, `watchersCount`

#### Scenario: Foreign key column naming
- **WHEN** a migration adds a foreign key reference to another table
- **THEN** the column SHALL be named `<entity>Uuid` in camelCase (e.g., `photoUuid`, `chatUuid`)

#### Scenario: Timestamp columns
- **WHEN** a migration creates a table with timestamps
- **THEN** it SHALL include `createdAt` and `updatedAt` columns with `allowNull: false` and `type: Sequelize.DATE`

### Requirement: New tables use UUID primary keys
All new tables SHALL use UUID as the primary key. The primary key column SHALL be named `id` with type `Sequelize.UUID` and `defaultValue: Sequelize.UUIDV4`.

#### Scenario: Creating a table with UUID primary key
- **WHEN** a new table is created
- **THEN** it SHALL define the primary key as:
  ```javascript
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  }
  ```

#### Scenario: Legacy integer IDs
- **WHEN** modifying an existing table that uses integer IDs
- **THEN** the migration SHALL work with the existing ID type and SHALL NOT change the primary key type unless that is the explicit purpose of the migration

### Requirement: Constraint and index names are descriptive
Index names SHALL follow the pattern `idx_<TableName>_<columnName>`. Constraint names SHALL follow the pattern `<type>_<TableName>_<description>` where type is `pk` for primary key, `fk` for foreign key, or `uq` for unique constraints.

#### Scenario: Adding a single-column index
- **WHEN** a migration adds an index on `Photos.location`
- **THEN** it SHALL be named `idx_Photos_location` or use the shorthand `queryInterface.addIndex('Photos', ['location'])`

#### Scenario: Adding a composite primary key constraint
- **WHEN** a migration adds a composite primary key on `WavePhotos(waveUuid, photoUuid)`
- **THEN** it SHALL use `queryInterface.addConstraint('WavePhotos', { fields: ['waveUuid', 'photoUuid'], type: 'primary key', name: 'pk_WavePhotos' })`

#### Scenario: Adding a foreign key constraint
- **WHEN** a migration adds a foreign key from `Comments.photoUuid` to `Photos.id`
- **THEN** the constraint name SHALL be descriptive (e.g., `fk_Comments_photoUuid`)

### Requirement: Prefer queryInterface methods over raw SQL
Migrations SHALL use `queryInterface` methods (`createTable`, `addColumn`, `removeColumn`, `changeColumn`, `renameColumn`, `addIndex`, `removeIndex`, `addConstraint`, `removeConstraint`) for standard DDL operations. Raw SQL via `queryInterface.sequelize.query()` SHALL be used only when queryInterface is insufficient.

#### Scenario: Standard column addition
- **WHEN** adding a column to a table
- **THEN** the migration SHALL use `await queryInterface.addColumn('Photos', 'likes', { type: Sequelize.INTEGER, defaultValue: 0 })`

#### Scenario: PostGIS GiST index creation
- **WHEN** creating a GiST index for full-text search
- **THEN** the migration SHALL use raw SQL: `await queryInterface.sequelize.query('CREATE INDEX idx_Recognitions_metaData_full_text ON "Recognitions" USING gist(...)')`

#### Scenario: PostgreSQL extension management
- **WHEN** enabling a PostgreSQL extension like PostGIS
- **THEN** the migration SHALL use raw SQL: `await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;')`

#### Scenario: Complex data transformation
- **WHEN** populating columns with computed values across rows
- **THEN** the migration SHALL use raw SQL UPDATE statements via `queryInterface.sequelize.query()`

### Requirement: PostGIS geometry columns use GEOMETRY type
PostGIS location columns SHALL use `Sequelize.GEOMETRY('POINT')` type. Spatial indexes on geometry columns SHALL use the standard PostGIS spatial indexing.

#### Scenario: Adding a location column
- **WHEN** a migration adds a geographic location column
- **THEN** it SHALL use `type: Sequelize.GEOMETRY('POINT')` with `allowNull` set explicitly

#### Scenario: Creating a table with location
- **WHEN** a table requires geographic data
- **THEN** the `location` column SHALL be defined as `{ type: Sequelize.GEOMETRY('POINT'), allowNull: false }`

### Requirement: Multi-step migrations log progress
Migrations with more than one operation SHALL log progress using `console.log`. Log messages SHALL use emoji indicators: `🔄` for migration start, `📝` for step progress, `✅` for successful completion, `✗` for errors.

#### Scenario: Multi-step migration logging
- **WHEN** a migration performs 3 sequential steps
- **THEN** it SHALL log:
  ```
  console.log('🔄 Starting migration: <description>')
  console.log('📝 Step 1: <description>...')
  // ... step 1 ...
  console.log('📝 Step 2: <description>...')
  // ... step 2 ...
  console.log('📝 Step 3: <description>...')
  // ... step 3 ...
  console.log('✅ Migration complete: <description>')
  ```

#### Scenario: Single-operation migration
- **WHEN** a migration performs only one operation (e.g., add one column)
- **THEN** logging is optional but recommended for data-affecting operations

### Requirement: Complex data migrations use try-catch with continue pattern
Data migrations that process multiple records SHALL wrap per-record operations in try/catch blocks and continue processing remaining records on non-critical errors. Critical structural failures SHALL still throw and abort the migration.

#### Scenario: Processing records with external dependencies
- **WHEN** a data migration processes rows that interact with external services (e.g., S3)
- **THEN** each record SHALL be wrapped in try/catch, logging errors and continuing:
  ```javascript
  try {
    await processRecord(record)
    console.log(`✅ Processed record ${record.id}`)
  } catch (error) {
    console.error(`✗ Error processing record ${record.id}:`, error.message)
    // Continue with next record
  }
  ```

#### Scenario: Schema-only migration error handling
- **WHEN** a schema-only migration fails (e.g., addColumn fails)
- **THEN** the error SHALL propagate and abort the migration (no try/catch wrapping around DDL)

### Requirement: Schema and data changes are separate migrations
When a change requires both schema modifications and data transformations, they SHALL be split into separate migration files with sequential timestamps. Schema migrations SHALL precede data migrations.

#### Scenario: Adding UUID columns with data population
- **WHEN** new UUID columns need to be added and populated from existing data
- **THEN** three separate migrations SHALL be created in order:
  1. `*-add-<entity>-uuid-columns.js` — adds the new columns (nullable)
  2. `*-populate-<entity>-uuid-columns.js` — populates data and sets NOT NULL
  3. `*-replace-<old>-with-<new>.js` — drops old columns, renames new ones

#### Scenario: Simple column addition with default value
- **WHEN** a new column is added with a static default value
- **THEN** a single migration file is sufficient (schema-only, no data transformation needed)

### Requirement: Migrations do not use explicit transactions
Migrations SHALL NOT use explicit `queryInterface.sequelize.transaction()` calls. Sequelize CLI automatically wraps each migration in a transaction. The implicit transaction handling is sufficient for all migration types in this project.

#### Scenario: Multi-step schema migration
- **WHEN** a migration adds a column and then an index
- **THEN** both operations SHALL be `await`-ed sequentially without wrapping in an explicit transaction

#### Scenario: Data migration with multiple updates
- **WHEN** a migration executes multiple UPDATE queries
- **THEN** all queries SHALL be `await`-ed sequentially within the implicit transaction
