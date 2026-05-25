## Why

The skip-non-matching auto-group algorithm creates an infinite loop when an active wave exists but no ungrouped photos match its locality. The entire batch is skipped, `photosGrouped` stays 0, but `hasMore` returns true because ungrouped photos remain. The frontend's `do...while(hasMore)` loop spins forever. This is a critical bug — the app hangs after processing ~10 waves.

## What Changes

- **Backend: close stale wave on zero progress** — After the main processing loop, if `photosGrouped === 0` and an active wave exists, deactivate it so the next call starts fresh with a new anchor
- **Frontend: add safety valve to auto-group loop** — Break out of the `do...while` loop when `photosGrouped === 0 && hasMore === true`, since this state means the backend is stuck

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auto-group-photos`: Add requirement that the system MUST deactivate the active wave when an entire batch yields zero grouped photos, preventing infinite loops

## Impact

- **Backend**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — add stale wave detection after the main loop
- **Frontend**: Auto-group loop caller — add stuck-state break condition
