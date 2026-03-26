## Context

The `listWaves` query is the primary entry point for users browsing their waves. It executes two SQL queries: one to fetch waves (joining `Waves` ↔ `WaveUsers`) and one to fetch thumbnail photos. The first query has three inefficiencies:

1. **`SELECT DISTINCT`** deduplicates on all columns despite the `WaveUsers` composite PK `(waveUuid, uuid)` already guaranteeing uniqueness per user-wave pair
2. **No index on `Waves.updatedAt`** — the default (and most common) sort column, forcing an in-memory sort of the full result set before LIMIT
3. **No covering index on `WaveUsers(uuid, waveUuid)`** — the existing single-column `(uuid)` index satisfies the filter but requires a heap lookup to retrieve `waveUuid` for the join

Current indexes:
- `Waves`: PK(`waveUuid`), `createdBy`, `createdAt`, `name`, `location` (GiST)
- `WaveUsers`: PK(`waveUuid, uuid`), `waveUuid`, `uuid`

## Goals / Non-Goals

**Goals:**
- Eliminate unnecessary `DISTINCT` overhead from the listWaves query
- Ensure the default sort path (`updatedAt DESC`) can leverage an index
- Enable index-only scans on `WaveUsers` for the user-wave join

**Non-Goals:**
- Cursor-based pagination (larger API change, deferred)
- Full-text search optimization with `pg_trgm` (separate concern)
- Removing the redundant single-column `WaveUsers(waveUuid)` index (cleanup, not performance-critical)
- Changes to the photos subquery (already efficient)

## Decisions

### Decision 1: Remove `DISTINCT` rather than adding a unique constraint

**Choice**: Remove `DISTINCT` from the SQL query.

**Rationale**: The `WaveUsers` table has a composite PK `(waveUuid, uuid)`, which already enforces uniqueness at the database level. The JOIN cannot produce duplicate wave rows for a single user. No additional constraint is needed — the PK *is* the constraint.

**Alternative considered**: Keep `DISTINCT` and add more indexes to make it faster. Rejected because `DISTINCT` on `SELECT *` with wide rows is inherently expensive and unnecessary here.

### Decision 2: Single migration for both indexes

**Choice**: Add both indexes (`Waves.updatedAt` and `WaveUsers(uuid, waveUuid)`) in a single migration file.

**Rationale**: Both are non-blocking `CREATE INDEX` operations on PostgreSQL. They are independent of each other and of the code change. Combining them reduces migration file count without adding risk.

### Decision 3: Standard B-tree index on `updatedAt` (not covering)

**Choice**: Simple B-tree index on `Waves.updatedAt`.

**Rationale**: The planner may or may not use it depending on selectivity (small result sets from the join may be cheaper to sort in-memory). But having the index gives the planner the *option*, which it currently lacks. A covering index including all Waves columns would be wasteful — the PK lookup after the sort is cheap.

## Risks / Trade-offs

- **Index write overhead** → Minimal. Two additional indexes add marginal overhead to INSERT/UPDATE on tables that are written infrequently compared to read frequency. Waves and WaveUsers are low-write tables.
- **Index not used by planner** → The `updatedAt` index may not be selected if the filtered result set is small enough that in-memory sort is cheaper. This is acceptable — the index costs almost nothing to maintain and helps for users with many waves.
- **Composite index partially overlaps PK** → `WaveUsers(uuid, waveUuid)` overlaps with PK `(waveUuid, uuid)` but with reversed column order. Both are needed: the PK serves lookups by `waveUuid`, the new index serves lookups by `uuid`. The existing single-column `(uuid)` index becomes redundant but removing it is deferred as a non-goal.
