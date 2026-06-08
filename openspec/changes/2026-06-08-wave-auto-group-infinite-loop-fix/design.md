# Design: Fix Infinite Loop in Waves Auto-Grouping

## Context

The `autoGroupPhotosIntoWaves` mutation uses a "skip-non-matching" approach: photos that don't match the active wave's locality are left ungrouped for subsequent iterations. This works when at least some photos match, but creates an infinite loop when none do.

### Root Cause Analysis

The bug occurs when `findOrCreateWave()` returns early due to `photo.id == null`:

```typescript
async function findOrCreateWave (photo: PhotoRow): Promise<void> {
  if (photo == null || photo.id == null) return  // ← EARLY RETURN!
  // ... rest of function (never executes)
}
```

When this happens:
1. `currentWave`, `currentWaveUuid`, `pendingWaveUuid` are never set
2. But `photosGrouped++` still runs (after the call)
3. `pendingPhotoIds = [photos[0].id]` is set
4. `flushWavePhotos()` is never called because `pendingWaveUuid === null`
5. Photos remain ungrouped → `hasMore = true` → infinite loop

### Code Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Normal Case (photo.id exists)                                     │
├─────────────────────────────────────────────────────────────────────┤
│  1. findOrCreateWave(photos[0])                                    │
│     ├─ Sets currentWave, pendingWaveUuid                           │
│     └─ Returns successfully                                        │
│  2. pendingPhotoIds = [photos[0].id]                               │
│  3. photosGrouped++                                                │
│  4. Loop processes remaining photos                                │
│  5. closeWave() or end-of-batch flushes photos to WavePhotos      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Bug Case (photo.id is null)                                       │
├─────────────────────────────────────────────────────────────────────┤
│  1. findOrCreateWave(photos[0])                                    │
│     ├─ photo.id == null → EARLY RETURN!                            │
│     ├─ currentWave NOT set                                         │
│     ├─ pendingWaveUuid NOT set                                     │
│     └─ Returns early                                               │
│  2. pendingPhotoIds = [photos[0].id]  ← Set but invalid           │
│  3. photosGrouped++  ← Incremented but no photos flushed!         │
│  4. Loop processes remaining photos                                │
│  5. flushWavePhotos() NOT called (pendingWaveUuid === null)       │
│  6. photosRemaining > 0, hasMore = true → INFINITE LOOP!          │
└─────────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Eliminate the infinite loop when photos are counted but not inserted
- Add defensive code to detect and recover from zero-progress batches

**Non-Goals:**
- Changing the skip-non-matching algorithm itself
- Changing how waves are created or named
- Frontend changes (handled in client repo)

## Decisions

### Decision 1: Backend stale wave detection

**Choice**: After the main processing loop, if `photosGrouped === 0` and `currentWave != null`, call `closeWave()` to deactivate the stale wave.

**Rationale**: Zero progress with an active wave is always a stuck state. Immediate deactivation is correct.

**Alternative considered**: Track "consecutive zero-progress calls" and only deactivate after N failures. Rejected — unnecessary complexity. Zero progress is always wrong.

**Alternative considered**: Only check if `pendingWaveUuid === null`. Rejected — `currentWave != null` is more robust (covers cases where pendingWaveUuid might be set but photos weren't flushed).

### Decision 2: Frontend break on stuck state

**Choice**: In the `do...while(hasMore)` loop, if `result.photosGrouped === 0 && result.hasMore === true`, break immediately. This is a contradictory state that should never persist.

**Rationale**: Defense-in-depth. Even if backend fix fails, frontend prevents infinite loop.

## Implementation Steps

### 1. Backend Fix (`lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`)

After the main `while` loop (around line 695), before counting remaining photos:

```typescript
// Flush remaining pending photos and update wave name
if (pendingWaveUuid != null && pendingPhotoIds.length > 0) {
  await flushWavePhotos(pendingWaveUuid, pendingPhotoIds, uuid)
  pendingPhotoIds = []
}

// NEW: Stale wave detection (after flush, before counting remaining)
if (photosGrouped === 0 && currentWave != null) {
  await closeWave()
}

if (currentWaveUuid != null && waveSeasonKey != null) {
  // ... rest of wave name update logic
}
```

### 2. Test

Add test case: when all photos are skipped (none match active wave), the active wave is deactivated and `hasMore` is true.

## Risks / Trade-offs

- **[Extra mutation call]** → After closing a stale wave, the client makes one "wasted" call (zero progress) before the next call creates a new wave. Acceptable — one extra call vs. infinite loop.
- **[No behavioral change for normal cases]** → The fix only activates when `photosGrouped === 0`, which shouldn't happen in normal operation. Normal cases are unaffected.
