## ADDED Requirements

### Requirement: Migration naming uses timestamped action format
Files use `YYYYMMDDHHmmss-action-description.js` naming with action verbs like create/add/populate/remove.

#### Scenario: Schema migration name
- **WHEN** adding a new column
- **THEN** file name follows timestamp plus `add-...` action

#### Scenario: Data migration name
- **WHEN** populating derived values
- **THEN** file name uses timestamp plus `populate-...` action

### Requirement: Migrations use async/await with explicit down behavior
Migrations are written with async/await and provide `down()` reversals where feasible. Irreversible data operations may throw with clear reason.

#### Scenario: Reversible schema migration
- **WHEN** up adds index/column/table
- **THEN** down removes that artifact

#### Scenario: Irreversible side-effect migration
- **WHEN** migration cannot safely restore prior state
- **THEN** down throws explicit irreversible error

### Requirement: Naming conventions follow project schema
Tables are PascalCase plural, columns are camelCase.

#### Scenario: Table naming example
- **WHEN** creating wave-related table
- **THEN** table name follows PascalCase plural style

### Requirement: Constraint naming follows existing repository practice
Repository includes explicit primary constraints in `*_pkey` style on some tables; new migrations should remain consistent with surrounding table conventions.

#### Scenario: Primary key naming consistency
- **WHEN** adding explicit PK constraint to join table
- **THEN** naming aligns with surrounding `*_pkey` repository style where applicable

### Requirement: queryInterface is preferred for standard DDL
Use queryInterface helpers for common DDL. Raw SQL is used when required for PostGIS/index/data transformation operations.

#### Scenario: Standard Add/Remove Column
- **WHEN** operation is basic DDL
- **THEN** migration uses queryInterface helper

#### Scenario: PostGIS/Index-Specific SQL
- **WHEN** operation requires SQL features not fully represented in helper API
- **THEN** migration uses raw SQL intentionally
