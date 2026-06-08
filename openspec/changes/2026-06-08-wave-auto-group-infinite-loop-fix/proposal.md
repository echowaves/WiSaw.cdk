# Proposal: Fix Infinite Loop in Waves Auto-Grouping

## Why

The `autoGroupPhotosIntoWaves` mutation has a critical infinite loop bug when photos are counted as "grouped" but never actually inserted into `WavePhotos`. This causes the client's `do...while(hasMore)` loop to spin forever.

### What's Broken

The bug occurs in this scenario:

1. `findOrCreateWave(photos[0])` is called for the first photo
2. If `photo.id == null` (edge case), the function returns early without setting `pendingWaveUuid`
3. The code continues: `pendingPhotoIds = [photos[0].id]` and `photosGrouped++`
4. But `pendingWaveUuid` is never set, so `flushWavePhotos()` is never called
5. Photos remain ungrouped, `hasMore = true`, infinite loop

### Impact

- **Users**: App hangs indefinitely when auto-grouping photos
- **Backend**: Wasted Lambda invocations, no progress made
- **Data**: Photos remain ungrouped indefinitely

## What Changes

### Backend Fix

In `autoGroupPhotosIntoWaves.ts`, after the main processing loop, add stale wave detection:

```typescript
// After main loop, before counting remaining photos
if (photosGrouped === 0 && currentWave != null) {
  await closeWave()
}
```

This deactivates any stale wave so the next call starts fresh.

### Frontend Safety Valve

In the auto-group `do...while(hasMore)` loop on the client, add a safety valve:

```javascript
do {
  const result = await autoGroupPhotosIntoWaves(uuid, groupingLevel)
  if (result.photosGrouped === 0 && result.hasMore === true) {
    break  // Prevent infinite loop
  }
} while (result.hasMore)
```

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: The mutation now detects and recovers from zero-progress batches where photos were counted but not inserted

## Impact

- **Backend**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — add stale wave detection after main loop
- **Client**: `do...while` auto-group loop — add stuck-state break condition (photosGrouped === 0 && hasMore === true)
- **Risk**: Low — this is defensive code that only activates in edge cases

## Risks / Trade-offs

- **[Extra mutation call]** → After closing a stale wave, the client makes one "wasted" call (zero progress) before the next call creates a new wave. Acceptable — one extra call vs. infinite loop.
- **[No behavioral change for normal cases]** → The fix only activates when `photosGrouped === 0`, which shouldn't happen in normal operation. Normal cases are unaffected.
