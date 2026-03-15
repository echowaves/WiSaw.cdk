## Context

Photos.commentsCount already follows this exact pattern: a persistent counter column updated via a `_updateCommentsCount` helper that runs a `COUNT(*)` subquery after each create/delete. The `Waves` table has no `photosCount` column today — it's computed at query time via `COUNT(*) OVER (PARTITION BY ...)` window functions in listWaves.

Five code paths modify `WavePhotos`:
1. `addPhoto.ts` — INSERT ON CONFLICT DO NOTHING
2. `removePhoto.ts` — DELETE by waveUuid + photoId
3. `autoGroupPhotosIntoWaves.ts` — bulk INSERT per wave
4. `processDeletedImage/index.ts` — DELETE by photoId (may affect multiple waves)
5. `delete.ts` — DELETE by waveUuid (wave deletion — no count update needed since wave is deleted)

## Goals / Non-Goals

**Goals:**
- Add `photosCount` column to `Waves` table with default 0
- Populate existing data via a separate data migration
- Auto-update `photosCount` from all write paths via a shared helper
- Simplify listWaves to read the column directly

**Non-Goals:**
- Using database triggers (keep logic in application code for consistency with existing patterns)
- Changing the `photos` thumbnail URL fetch (only the count computation changes)

## Decisions

**1. Use a COUNT(*) subquery helper (same pattern as `_updateCommentsCount`)**
- Rationale: Proven pattern in this codebase. Recounting is safe against race conditions — always reflects the true state.
- Alternative: INCREMENT/DECREMENT — faster but fragile with ON CONFLICT DO NOTHING and multi-wave deletes.

**2. Separate schema migration from data population migration**
- Rationale: Follows the project's migration conventions (separation of concerns). Schema change is reversible; data population runs UPDATE.

**3. For `processDeletedImage`, query affected waveUuids before deleting, then update each**
- Rationale: The DELETE removes by photoId which may span multiple waves. We need the waveUuids before the rows are gone.

**4. For `autoGroupPhotosIntoWaves`, update count once per wave after all photos are assigned**
- Rationale: The `createWaveAndAssign` function inserts photo by photo. A single count update after the wave is fully populated is more efficient than per-photo updates.

## Risks / Trade-offs

- [Count drift] → Mitigated by using COUNT(*) subquery (always accurate) rather than increment/decrement.
- [Extra query per write] → One small UPDATE per write operation. Acceptable given the low write frequency.
