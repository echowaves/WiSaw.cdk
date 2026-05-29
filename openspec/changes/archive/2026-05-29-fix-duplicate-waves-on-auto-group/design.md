## Context

`autoGroupPhotosIntoWaves` is a GraphQL mutation that groups ungrouped photos into waves. The client calls it repeatedly (batches of 1000) until `hasMore` is false. Production data shows that concurrent calls for the same user create duplicate waves — both calls read the same ungrouped photos, both create a wave, and `ON CONFLICT DO NOTHING` on `WavePhotos` splits the photos between them.

A secondary issue: `closeWave()` and the final flush UPDATE the wave's anchor fields (`anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`) to the most-frequent locality. When all photos lack locality data, `getMostFrequentLocality` returns null, wiping the anchors to NULL. This prevents `findMatchingWave` from finding the wave in subsequent batches, causing additional duplicates.

The function runs in AWS Lambda behind AppSync. Lambda can execute multiple concurrent invocations for the same user if the client fires overlapping requests. The PostgreSQL connection uses `serverless-postgres`.

## Goals / Non-Goals

**Goals:**
- Prevent concurrent executions of `autoGroupPhotosIntoWaves` for the same user from creating duplicate waves
- Prevent anchor field mutation from causing cross-batch wave matching failures

**Non-Goals:**
- Merging existing duplicate waves (separate operation, can use existing `mergeWaves`)
- Changing the wave name refinement logic (name display can still be updated)
- Adding a database migration

## Decisions

### Decision 1: PostgreSQL advisory lock for concurrency control

Use `pg_try_advisory_lock(hashtext('autoGroup:' || uuid))` at the start of `autoGroupPhotosIntoWaves`. If the lock cannot be acquired (another call is in progress), return early with `{ photosGrouped: 0, hasMore: true }` so the client retries.

**Why advisory lock over alternatives:**
- **vs. application mutex / DynamoDB lock**: Advisory lock lives in PostgreSQL, requires no additional infrastructure, is automatically released on connection close (no stale lock risk)
- **vs. `pg_advisory_lock` (blocking)**: Non-blocking `pg_try_advisory_lock` is better for Lambda — avoids holding a Lambda invocation idle waiting for a lock, which costs money and wastes concurrency slots
- **vs. `SELECT ... FOR UPDATE SKIP LOCKED`**: Would require restructuring the query model; advisory lock is a simpler change with the same effect

The lock is released explicitly at the end of the function via `pg_advisory_unlock` before `psql.clean()`. If the Lambda crashes, the connection is closed by `serverless-postgres`, which releases the lock automatically.

### Decision 2: Stop mutating anchor fields, update name only

Change both `closeWave()` and the final flush UPDATE to only write the `name` column, not `anchorLocality/District/Region/Country`. Anchors are identity fields used for wave matching in `findMatchingWave`; the wave name is a display field derived from frequency analysis. These serve different purposes and should not be coupled.

**Why not COALESCE fallback:**
- `COALESCE($2, "anchorLocality")` would prevent NULL-wipe but still allows drift (e.g., anchor changes from "Canton" to "Hull")
- Drift causes the same problem: subsequent batches may not find the wave by string match if the anchor changed
- Clean separation (anchors = stable identity, name = dynamic display) is simpler to reason about

## Risks / Trade-offs

- **[Risk] Advisory lock key collision**: `hashtext` produces a 32-bit integer, so theoretical collision across different users is possible → Mitigation: Collision rate is negligible for the user count; worst case is one user's auto-group waits for another's, which is harmless
- **[Risk] Client retries on lock contention**: Client receives `hasMore: true` with `photosGrouped: 0` → Mitigation: Client already loops on `hasMore`, so it naturally retries. The contending call will finish quickly, releasing the lock
- **[Trade-off] Frozen anchor names**: Wave anchor will always reflect the first photo's geo, even if most photos are from a different locality → Acceptable: anchor is for matching only, the display name still reflects the most-frequent locality
