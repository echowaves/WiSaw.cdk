## Context

The `autoGroupPhotosIntoWaves` mutation uses a skip-non-matching approach: photos that don't match the active wave's locality are left ungrouped for subsequent iterations. This works when at least some photos match, but creates an infinite loop when none do — the active wave persists, the same ungrouped photos are fetched again, all skipped again, forever.

## Goals / Non-Goals

**Goals:**
- Eliminate the infinite loop when no photos match the active wave
- Add frontend safety valve as defense-in-depth

**Non-Goals:**
- Changing the skip-non-matching algorithm itself
- Changing how waves are created or named

## Decisions

### Decision 1: Deactivate stale wave after zero-progress batch

**Choice**: After the main processing loop, if `photosGrouped === 0` and `activeWave != null`, call `closeWave()` to deactivate it. The next mutation call will find no active wave, pick the first ungrouped photo as anchor, and make progress.

**Alternative considered**: Track "consecutive zero-progress calls" and only deactivate after N failures. Rejected — unnecessary complexity. Zero progress with an active wave is always a stuck state; immediate deactivation is correct.

**Alternative considered**: Force the first non-matching photo to start a new wave (reverting to break-on-first-miss for the first photo only). Rejected — this defeats the skip-non-matching design. Closing the stale wave is cleaner.

### Decision 2: Frontend break on stuck state

**Choice**: In the `do...while(hasMore)` loop, if `result.photosGrouped === 0 && result.hasMore === true`, break immediately. This is a contradictory state that should never persist.

## Risks / Trade-offs

- **[Extra mutation call]** → After closing a stale wave, the client makes one "wasted" call (zero progress) before the next call creates a new wave. Acceptable — one extra call vs. infinite loop.
- **[Frontend fix is only a safety net]** → The backend fix is the root cause. Frontend break prevents hangs even if other stuck states are discovered later.
