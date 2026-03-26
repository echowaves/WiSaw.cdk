## Why

The `listWaves` query becomes slow as users accumulate more waves. The current implementation uses an unnecessary `DISTINCT` (forcing a full deduplication pass on every column), sorts on an unindexed column (`updatedAt`), and performs a heap lookup on `WaveUsers` that could be avoided with a covering index. These are low-risk, high-impact database-level optimizations with no API or behavioral changes.

## What Changes

- Remove `DISTINCT` from the `listWaves` SQL query — the `WaveUsers` composite PK `(waveUuid, uuid)` already guarantees no duplicate rows per user, making `DISTINCT` redundant overhead.
- Add a B-tree index on `Waves.updatedAt` — the default sort column currently has no index, forcing an in-memory sort of all matched rows before LIMIT is applied.
- Add a composite index `(uuid, waveUuid)` on `WaveUsers` — enables index-only scans for the join, avoiding heap lookups on the `WaveUsers` table.

## Capabilities

### New Capabilities

- `list-waves-performance`: Database indexing and query optimizations for the `listWaves` query path

### Modified Capabilities

_None — no behavioral or requirement changes. All optimizations are internal implementation details._

## Impact

- **Code**: `lambda-fns/controllers/waves/listWaves.ts` — query string change (remove `DISTINCT`)
- **Database**: New migration adding two indexes (`Waves.updatedAt`, `WaveUsers(uuid, waveUuid)`)
- **APIs**: No changes — identical inputs, outputs, and behavior
- **Risk**: Low — adding indexes is non-blocking in PostgreSQL; removing `DISTINCT` is safe given the PK constraint
