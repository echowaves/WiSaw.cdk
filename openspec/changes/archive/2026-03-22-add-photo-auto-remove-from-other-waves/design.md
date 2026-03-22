## Context

`addPhotoToWave` currently queries for an existing `WavePhotos` row for the given `photoId`. If the photo is in a different wave, it throws `"Photo is already in a wave"`. The constraint is that a photo can only belong to one wave at a time (enforced at application level). The underlying `WavePhotos` table uses `ON CONFLICT ("waveUuid", "photoId") DO NOTHING` for idempotent re-adds to the same wave.

## Goals / Non-Goals

**Goals:**
- Allow `addPhotoToWave` to implicitly move a photo from its current wave to the target wave
- Keep `photosCount` accurate on both the source and target waves

**Non-Goals:**
- Changing the one-photo-one-wave constraint
- Adding a separate `movePhotoToWave` mutation — reuse the existing `addPhotoToWave`

## Decisions

### 1. Replace error with DELETE + INSERT
**Decision:** When a photo is already in a different wave, delete the `WavePhotos` row from the old wave then insert into the new wave (existing INSERT logic). Update `photosCount` on both waves.

**Rationale:** Minimal code change — replaces the throw block with a DELETE and a `_updatePhotosCount` call for the old wave. The existing INSERT and target `_updatePhotosCount` remain unchanged.

### 2. No transaction wrapper needed
**Decision:** The operations (DELETE old, INSERT new, update counts) run sequentially on the same connection. If any step fails, the Lambda errors and the partial state is acceptable — `_updatePhotosCount` recalculates from actual rows, so counts self-heal on the next operation.

**Rationale:** Adding explicit transaction management adds complexity. The existing codebase pattern (sequential queries, no transactions) is consistent across all wave controllers.

## Risks / Trade-offs

- **[Self-healing counts]** If the Lambda fails between DELETE and INSERT, the photo is temporarily orphaned (not in any wave). The count on the old wave will be correct (recalculated), and the user can retry the add.
- **[No notification to old wave]** The old wave's owner isn't notified that a photo was removed. This matches the existing `removePhoto` behavior which also has no notification.
