## Context

The original `mergeWaves` implementation (`openspec/changes/archive/2026-03-22-merge-waves/design.md`) supported merging exactly two waves. The controller loop was linear: validate → move photos → merge users → delete source. This change extends that to N source waves while preserving all existing design decisions.

## Decisions

### 1. Sequential per-source merge loop

**Decision:** Iterate over `sourceWaveUuids`, applying the existing single-source merge logic (move photos, merge users, delete source) for each one, then update metadata once.

**Rationale:** The single-source logic is already proven and tested. Looping over it preserves the same SQL patterns and avoids introducing new edge cases. The `ON CONFLICT DO NOTHING` on WaveUsers means later sources can safely merge users that were already merged from earlier sources.

### 2. Freeze-state removal for owners

**Decision:** Remove any freeze-state checks. Only `_assertWaveRole(waveUuid, uuid, 'owner')` gates the merge.

**Rationale:** If the user is the owner of a frozen wave, they should be able to merge it. The freeze state was originally designed to prevent uncontrolled modifications by non-owners, not to block the owner from consolidating their own waves.

### 3. Target wave name preserved

**Decision:** The target wave's name is kept as-is. An optional `name` parameter allows the caller to override it.

**Rationale:** Computing a "best" name from N merged waves would require heuristics (e.g., most-photos wave, most-recent wave). The user explicitly chooses the target wave and knows which name they want. The `name` override covers the case where the user wants a consolidated name.

### 4. Single photosCount recalculation

**Decision:** Call `_updatePhotosCount(targetWaveUuid)` once after all sources are merged, not once per source.

**Rationale:** Each per-source photo move changes the count, but only the final count matters for the returned wave. One recalculation is sufficient and avoids N redundant `COUNT(*)` queries.

## Risks / Trade-offs

- **[Partial merge on crash]** If the Lambda crashes mid-loop, some sources may have had their photos moved while others remain untouched. → Same risk as the original 2-wave merge (single-connection, no explicit transaction). The most critical step (photo move) is a single atomic UPDATE per source.

- **[N-wave performance]** For N=1000 sources, this issues ~4000 SQL queries sequentially. → At current scale this is not a concern. WavePhotos updates are fast; the bottleneck would be network round-trips, but all queries run on the same connection.
