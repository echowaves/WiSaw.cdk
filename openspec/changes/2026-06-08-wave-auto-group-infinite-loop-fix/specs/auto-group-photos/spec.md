# Spec: Auto-Group Photos - Infinite Loop Fix

## Purpose

This spec describes the fix for the infinite loop bug in `autoGroupPhotosIntoWaves` where photos are counted as "grouped" but never actually inserted into `WavePhotos`.

## Requirements

### Requirement: No Infinite Loop on Zero Progress

The system MUST detect and recover from zero-progress batches where photos were counted but not inserted.

#### Scenario: Zero progress with active wave

- **GIVEN** an active wave exists from a previous call
- **GIVEN** photosGrouped === 0 (photos counted but not flushed)
- **WHEN** the main processing loop completes
- **THEN** `closeWave()` is called to deactivate the stale wave
- **AND** the result has `photosGrouped: 0`, `hasMore: true`, and `photosRemaining > 0`

#### Scenario: Frontend stuck state detection

- **GIVEN** the client receives a result with `photosGrouped === 0 && hasMore === true`
- **WHEN** the `do...while(hasMore)` loop checks this condition
- **THEN** the loop breaks to prevent infinite loop
- **AND** the client can retry with a fresh auto-group call

### Requirement: Photos Inserted When Grouped

The system MUST insert photos into `WavePhotos` when they are counted as grouped.

#### Scenario: Normal grouping

- **GIVEN** photos are matched to a wave
- **WHEN** they are added to `pendingPhotoIds` and `photosGrouped` is incremented
- **THEN** `flushWavePhotos()` is called (either via `closeWave()` or end-of-batch)
- **AND** photos are inserted into `WavePhotos` table

#### Scenario: Photos not counted without being inserted

- **GIVEN** a photo's `id` is null
- **WHEN** `findOrCreateWave()` is called with that photo
- **THEN** the function returns early
- **AND** `photosGrouped` is NOT incremented (backend fix)
- **AND** `pendingWaveUuid` is NOT set
- **AND** no insert attempt is made

### Requirement: Stale Wave Deactivation

The system MUST deactivate stale waves after zero-progress batches.

#### Scenario: Stale wave from null photo ID

- **GIVEN** an active wave exists with `currentWave != null`
- **GIVEN** photosGrouped === 0 (due to null photo ID)
- **WHEN** the main loop completes
- **THEN** `closeWave()` is called
- **AND** `currentWave` is set to null
- **AND** next invocation starts with fresh wave creation

#### Scenario: Stale wave from failed flush

- **GIVEN** an active wave exists
- **GIVEN** `pendingWaveUuid` is null (flush failed or never set)
- **GIVEN** photos were counted but not flushed
- **WHEN** the main loop completes
- **THEN** `closeWave()` is called to reset state

## Implementation Notes

### Backend Fix Location

In `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`:

```typescript
// After main loop, after flushing pending photos
if (pendingWaveUuid != null && pendingPhotoIds.length > 0) {
  await flushWavePhotos(pendingWaveUuid, pendingPhotoIds, uuid)
  pendingPhotoIds = []
}

// NEW: Stale wave detection
if (photosGrouped === 0 && currentWave != null) {
  await closeWave()
}

// Continue with wave name update...
```

### Frontend Safety Valve Location

In the client's auto-group loop:

```javascript
do {
  const result = await autoGroupPhotosIntoWaves(uuid, groupingLevel)
  
  // NEW: Stuck state detection
  if (result.photosGrouped === 0 && result.hasMore === true) {
    console.warn('Auto-group stuck state detected, breaking to prevent infinite loop')
    break
  }
  
} while (result.hasMore)
```
