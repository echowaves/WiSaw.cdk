## Why

The project has 27 Sequelize migrations spanning 2017–2025 with patterns that have evolved significantly over time (promise-chain → async/await, INTEGER PKs → UUID PKs, simple DDL → complex data migrations with external system interaction). No documented conventions exist for writing new migrations, leading to inconsistency. Codifying the current conventions ensures new migrations follow established patterns and AI-assisted generation produces correct, idiomatic migration files.

## What Changes

- Create a spec defining the migration file naming, structure, and lifecycle conventions
- Document the Sequelize `queryInterface` usage patterns for schema changes (create table, add/rename/remove columns, constraints, indexes)
- Document the raw SQL patterns for data migrations and complex type conversions
- Define the table and column naming rules (PascalCase tables, camelCase columns)
- Define the rollback (down) method conventions
- Document the PostGIS-specific migration patterns

## Capabilities

### New Capabilities
- `db-migration-conventions`: Rules and patterns for writing Sequelize database migrations — file naming, up/down structure, queryInterface API usage, raw SQL for data migrations, naming conventions (tables, columns, constraints, indexes), PostGIS support, logging, error handling, and rollback strategies

### Modified Capabilities
_None — this is a new cross-cutting architecture spec._

## Impact

- No code changes — documentation-only change
- New spec created at `openspec/specs/db-migration-conventions/spec.md`
- Serves as a guardrail for future migration authoring and AI-assisted migration generation
- Complements existing `database-access-patterns` spec (which covers runtime query patterns, not schema evolution)
