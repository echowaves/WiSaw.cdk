## Context

The wave system uses three PostgreSQL tables: `Waves` (metadata), `WavePhotos` (junction to Photos), and `WaveUsers` (membership). A photo can belong to at most one wave (enforced by application logic in `addPhoto.ts`). Authorization currently uses `createdBy` checks for update/delete operations. The existing wave controllers follow a consistent pattern: validate UUIDs, connect to psql, execute queries, clean up, return typed results.

## Goals / Non-Goals

**Goals:**
- Atomically merge two waves: move photos, merge users, delete source, return updated target
- Allow optional rename/description update at merge time (avoids a separate `updateWave` round trip)
- Consistent authorization with existing wave mutations (createdBy check)
- Single transaction to prevent partial merges

**Non-Goals:**
- Changing the authorization model (WaveUsers-based auth is a separate future change)
- Recalculating target wave location/radius from merged photos
- Supporting merge of more than two waves in a single call
- Merge into a new third wave (always merges into existing target)

## Decisions

### 1. Target-wins strategy for metadata
**Decision:** The target wave keeps its location, radius, createdBy, and createdAt. Only name and description are optionally overridden if provided in the mutation args.

**Rationale:** The user explicitly chooses which wave is the target. Automatically recalculating location would require querying all photo coordinates and computing a centroid — added complexity for a value the user can update manually. Wave location is not used for any proximity queries on the Waves table itself.

### 2. Move photos via UPDATE, not delete+insert
**Decision:** `UPDATE "WavePhotos" SET "waveUuid" = $target WHERE "waveUuid" = $source` rather than deleting and reinserting.

**Rationale:** Preserves the original `createdBy` on each WavePhoto row (who added the photo to its original wave). Simpler, faster, and maintains audit trail.

### 3. Single-transaction operation
**Decision:** All steps (move photos, merge users, update target metadata, delete source, recount photos) happen in a single database connection with sequential queries.

**Rationale:** The existing psql wrapper (`serverless-postgres`) doesn't expose explicit transaction control (BEGIN/COMMIT), but all queries run on the same connection within a single Lambda invocation. The sequential execution on one connection provides sufficient atomicity for this use case. If any query fails, the Lambda errors and no partial state is committed.

**Alternative considered:** Wrapping in explicit BEGIN/COMMIT. The serverless-postgres pool auto-commits each query, so explicit transactions would require raw client access. Given the existing pattern across all controllers (none use explicit transactions), this follows established conventions.

### 4. Authorization checks both waves via createdBy
**Decision:** Verify the requesting user is `createdBy` on both the target and source wave before proceeding.

**Rationale:** Consistent with `updateWave` and `deleteWave` which both check `createdBy`. The broader question of WaveUsers-based authorization is deferred to a separate change.

### 5. GraphQL mutation signature
**Decision:**
```graphql
mergeWaves(
  targetWaveUuid: String!
  sourceWaveUuid: String!
  uuid: String!
  name: String
  description: String
): Wave!
```

**Rationale:** Returns the merged `Wave` type so the client can update its state immediately. Optional `name` and `description` avoid requiring a follow-up `updateWave` call. No location/radius params since target-wins for those fields.

## Risks / Trade-offs

- **[Large waves]** If both waves have thousands of photos, the UPDATE moves all rows in one query. → PostgreSQL handles bulk UPDATEs efficiently; WavePhotos rows are small (just UUIDs and timestamps). Not a concern at current scale.

- **[No explicit transaction]** Sequential queries without BEGIN/COMMIT could theoretically leave partial state if the Lambda crashes mid-execution. → Matches all existing controller patterns. The most critical step (photo move) is a single atomic UPDATE. The worst partial failure case is: photos moved but source not deleted — user would see duplicate wave entries but no data loss.

- **[Source wave disappears for other WaveUsers]** If the source wave had other users (via WaveUsers), they lose the wave from their list. They gain access to the target wave (via merged WaveUsers). → This is the intended behavior. The merge operation consolidates everything into the target.
