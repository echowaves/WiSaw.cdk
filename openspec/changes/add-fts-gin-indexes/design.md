## Context

The `buildSearchClause` utility generates a subquery filtering photos by full-text search on `Recognitions.metaData` and `Comments.comment`. PostgreSQL's `to_tsvector` is computed per-row without an index. The `feedByDate` controller runs this subquery 15 times in parallel (one per day), compounding the cost. The Lambda has a 30-second timeout.

## Goals / Non-Goals

**Goals:**
- Make FTS subqueries use index lookups instead of full table scans
- Resolve the `feedByDate` timeout when search term is provided

**Non-Goals:**
- Changing the search query structure
- Pre-fetching IDs for `feedByDate` (separate optimization, may not be needed after indexing)
- Adding indexes to other columns

## Decisions

### Use expression-based GIN indexes matching the exact query expressions

**Decision**: Create GIN indexes on the exact `to_tsvector('English', ...)` expressions used in queries.

**Rationale**: PostgreSQL only uses a GIN index for `@@` operators when the index expression matches the query expression exactly. The indexes must use `to_tsvector('English', "metaData"::text)` and `to_tsvector('English', "comment"::text)` respectively — matching what `buildSearchClause` emits.

**Alternatives considered**:
- Generated columns with tsvector type + index: More complex, requires schema change. Rejected — expression index is simpler and achieves the same result.
- Trigram indexes (pg_trgm): Different use case (LIKE/ILIKE), not for `@@` operator. Rejected.

### Use raw SQL in migration

**Decision**: Use `queryInterface.sequelize.query()` for the CREATE INDEX statements.

**Rationale**: Per migration conventions, raw SQL is the correct approach for full-text search indexes. `queryInterface.addIndex()` doesn't support expression-based GIN indexes.

## Risks / Trade-offs

- **Index build time**: `CREATE INDEX` locks the table briefly. For large tables, this could cause a short write pause. Mitigation: `CONCURRENTLY` could be used but isn't compatible with transactions (Sequelize migrations run in transactions). For current data volumes, standard CREATE INDEX is acceptable.
- **Storage**: GIN indexes add storage overhead. Acceptable tradeoff for query performance.
