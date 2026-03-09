---
    description: Rules and conventions for writing Sequelize database migrations
    applyTo: 'migrations/**'
---
# Database Migration Conventions

## File naming
- Format: `YYYYMMDDHHmmss-kebab-case-description.js`
- Start description with action verb: `create-`, `add-`, `remove-`, `rename-`, `populate-`, `replace-`

## Structure
- Use `async/await` with `module.exports = { up: async (queryInterface, Sequelize) => { ... }, down: async (queryInterface, Sequelize) => { ... } }`
- Do NOT use promise chains or `.then()` syntax
- Always include `'use strict'` at the top

## Down method
- Every migration MUST implement `down()` that fully reverses `up()`
- For irreversible migrations, `down()` MUST throw: `throw new Error('Migration is irreversible: <reason>')`
- Multi-step reversals MUST be in reverse order (up: A→B→C, down: C→B→A)

## Naming conventions
- Table names: PascalCase plural (`Photos`, `AbuseReports`, `ChatUsers`)
- Column names: camelCase (`commentsCount`, `photoUuid`, `watchedAt`)
- Timestamps: `createdAt` and `updatedAt` with `allowNull: false`, `type: Sequelize.DATE`
- Index names: `idx_<TableName>_<columnName>`
- Constraint names: `pk_`, `fk_`, or `uq_` prefix + `<TableName>_<description>`
- Foreign key columns: `<entity>Uuid` (e.g., `photoUuid`, `chatUuid`)

## Primary keys
- New tables MUST use UUID: `{ type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true }`
- Do NOT change existing integer PKs unless that is the migration's explicit purpose

## API usage
- Prefer `queryInterface` methods (`createTable`, `addColumn`, `removeColumn`, `changeColumn`, `renameColumn`, `addIndex`, `removeIndex`, `addConstraint`, `removeConstraint`)
- Use raw SQL (`queryInterface.sequelize.query()`) only for: PostGIS GiST indexes, full-text search indexes, complex UPDATE statements, PostgreSQL extension management

## PostGIS
- Location columns: `type: Sequelize.GEOMETRY('POINT')` with explicit `allowNull`

## Logging
- Multi-step migrations MUST log progress with `console.log`
- Use emoji indicators: `🔄` start, `📝` step, `✅` complete, `✗` error
- Single-operation migrations: logging is optional

## Error handling
- Schema-only migrations: let errors propagate (no try/catch around DDL)
- Data migrations processing multiple records: wrap per-record operations in try/catch, log errors, continue with remaining records

## Separation of concerns
- Split schema changes and data transformations into separate migration files with sequential timestamps
- Schema migrations precede data migrations
- Example sequence: `add-columns` → `populate-columns` → `finalize-schema`

## Transactions
- Do NOT use explicit `queryInterface.sequelize.transaction()` — Sequelize CLI wraps each migration automatically
