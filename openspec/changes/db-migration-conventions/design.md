## Context

The project contains 27 Sequelize migrations spanning 2017–2025 that have evolved organically through three distinct phases:

1. **Early (2017–2021)**: Arrow functions with promise chains, incomplete `down()` methods, no logging or error handling. Schema-only DDL operations.
2. **Transitional (2022)**: Mixed patterns, some incomplete promise chains, growing complexity.
3. **Modern (2025+)**: Async/await, comprehensive logging with emoji indicators, try/catch error handling, complex data migrations coordinating across multiple tables and external systems (S3).

No documented conventions exist, causing inconsistency between migrations. This design codifies the modern (2025+) patterns as the standard for all new migrations.

**Existing conventions that intersect:**
- `data-model-conventions` spec: Defines PascalCase tables, camelCase columns, UUID primary keys, `string` timestamps
- `database-access-patterns` spec: Covers runtime query patterns and PostGIS usage with `ST_MakePoint`/`ST_Distance`

## Goals / Non-Goals

**Goals:**
- Define a single authoritative spec for writing new Sequelize migrations
- Codify file naming, structure, queryInterface patterns, raw SQL usage, naming, logging, error handling, and rollback conventions
- Ensure AI-assisted migration generation produces correct, idiomatic files
- Align with the modern async/await patterns established in 2025 migrations

**Non-Goals:**
- Retroactively fixing or rewriting existing legacy migrations
- Changing the migration tooling (Sequelize CLI remains the runner)
- Defining runtime query patterns (covered by `database-access-patterns` spec)
- Defining model class conventions (covered by `data-model-conventions` spec)

## Decisions

### 1. Async/await as the only supported syntax
**Decision**: All new migrations SHALL use `async/await` with `module.exports = { up: async (queryInterface, Sequelize) => { ... } }`.
**Rationale**: Promise chains are harder to read and have led to bugs in existing migrations (missing returns in `down()` methods in `photo-likes.js`, `photo-comments-count.js`). Async/await eliminates this entire class of errors.
**Alternative considered**: Continuing to allow both styles — rejected because consistency reduces cognitive load and tooling complexity.

### 2. Every migration must have a reversible down() method
**Decision**: All migrations SHALL implement a `down()` method that fully reverses `up()`. For truly irreversible data migrations (e.g., S3 renames), `down()` SHALL throw an explicit error explaining why reversal is not possible.
**Rationale**: Several legacy migrations have broken `down()` methods that silently fail. An explicit throw is better than a silent no-op.
**Alternative considered**: Allowing empty `down()` methods — rejected because it masks intentional irreversibility from accidental omission.

### 3. Console.log for step-by-step progress tracking
**Decision**: Migrations with multiple steps SHALL log progress using `console.log` with emoji indicators (`🔄` start, `📝` step, `✅` complete, `✗` error). Single-operation migrations (e.g., add one column) need only a start/complete log.
**Rationale**: The 2025 migration logs proved invaluable during the UUID migration. This pattern is cheap and pays off during debugging and production deployment.
**Alternative considered**: Using a logging library — rejected as over-engineering for migration scripts that run infrequently.

### 4. Rely on Sequelize's implicit transaction wrapping
**Decision**: Migrations SHALL NOT use explicit transactions. Sequelize CLI wraps each migration in a transaction automatically.
**Rationale**: No existing migration uses explicit transactions, and PostgreSQL's DDL is transactional. The implicit wrapping has been sufficient for all 27 existing migrations.
**Alternative considered**: Requiring explicit transactions for data migrations — rejected because it adds boilerplate without clear benefit given PostgreSQL's transactional DDL.

### 5. Schema migrations separate from data migrations
**Decision**: When a change requires both schema changes and data transformation, they SHALL be split into separate migration files with sequential timestamps (e.g., `add-columns` → `populate-columns` → `finalize-schema`). Each file SHALL be independently reversible.
**Rationale**: The 2025 UUID migration demonstrates this pattern successfully (3 coordinated migrations). It makes each step independently testable and reversible.

### 6. Raw SQL only when queryInterface is insufficient
**Decision**: Prefer `queryInterface` methods for all standard DDL. Raw SQL via `queryInterface.sequelize.query()` SHALL be used only for PostGIS indexes (GiST), full-text search indexes (tsvector), complex UPDATE statements in data migrations, and PostgreSQL extension management.
**Rationale**: `queryInterface` provides a consistent API that handles quoting and dialect differences. Raw SQL is necessary only for PostgreSQL-specific features not exposed by Sequelize.

### 7. Naming conventions align with data-model-conventions
**Decision**: Table names SHALL be PascalCase plural (e.g., `Photos`, `AbuseReports`). Column names SHALL be camelCase (e.g., `commentsCount`, `photoUuid`). Constraint and index names SHALL be descriptive (e.g., `idx_Photos_location`, `pk_WavePhotos`).
**Rationale**: Consistent with all 27 existing migrations and the `data-model-conventions` spec.

## Risks / Trade-offs

- **[Legacy inconsistency]** → New migrations will look different from 2017-era migrations. Mitigated by documenting this as intentional evolution, not requiring backfill.
- **[Irreversible migration throws]** → A `down()` that throws prevents rolling back past that point. Mitigated by requiring these to be rare and well-documented in the migration file itself.
- **[No explicit transactions]** → Complex data migrations could partially fail. Mitigated by PostgreSQL's transactional DDL and Sequelize's implicit transaction wrapping.
