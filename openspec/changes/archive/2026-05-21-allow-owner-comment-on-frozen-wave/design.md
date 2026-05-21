## Context

The `_isPhotoInFrozenWave` utility in `lambda-fns/controllers/waves/_isPhotoInFrozenWave.ts` currently blocks ALL comments on photos belonging to frozen waves. This is a blanket restriction that doesn't distinguish between the wave owner/facilitator and other users. Wave owners need to manage content — adding context, clarifying descriptions, responding to comments — even when their wave is frozen.

Waves have two roles relevant here: `owner` (via `Waves.createdBy`) and `facilitator` (via `WaveUsers.role = 'facilitator'`). Photos are single-wave only per project constraints.

## Goals / Non-Goals

**Goals:**
- Allow wave owner and facilitator to comment on photos in their own frozen waves
- Keep delete path strict — unfreezing required as stop-gap before deleting comments on frozen-wave photos

**Non-Goals:**
- Changing the freeze mechanism itself (splashDate, freezeDate, freezeMode)
- Allowing non-owner/facilitator users to comment on frozen waves
- Modifying photo mutations beyond comments (delete/update handled separately if needed later)

## Decisions

1. **Rename `_isPhotoInFrozenWave` → `_isPhotoInFrozenWaveForUser(photoId, uuid)`**
   - The old function had no user context and returned a binary "frozen or not" answer
   - The new function takes the requesting user's UUID and checks if they're owner/facilitator of any frozen wave containing this photo
   - If yes → return false (allow). Otherwise → original check.

2. **Use LEFT JOIN on WaveUsers for facilitator check**
   ```sql
   SELECT 1 FROM "WavePhotos" wp
   JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
   LEFT JOIN "WaveUsers" wu ON wu."waveUuid" = wp."waveUuid" AND wu."uuid" = $2
   WHERE wp."photoId" = $1
     AND (w."createdBy" = $2 OR wu."role" = 'facilitator')
     AND (<frozen check>)
   LIMIT 1
   ```

3. **Keep `_isPhotoInFrozenWave` for strict checks**
   - Delete operations use the original strict function — unfreezing required as stop-gap
   - This avoids breaking existing callers that need strict behavior

4. **Single query approach (not two queries)**
   - One query with LEFT JOIN handles both owner and facilitator in a single pass
   - Simpler than running separate checks for each role

## Risks / Trade-offs

- [Risk] The new function has different semantics from the old one — callers must always provide uuid. → Mitigation: Remove the old function entirely; rename is unambiguous.
- [Risk] A photo could theoretically belong to multiple waves (WavePhotos composite key). If user owns wave X but not wave Y, and both contain the photo, they can comment. → Mitigation: Photos are single-wave only per project constraint.

## Migration Plan

No database migration needed — this is purely a code change using existing tables (`Waves`, `WaveUsers`, `WavePhotos`). Deploy should be straightforward with no data movement.
