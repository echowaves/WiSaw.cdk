## Why

`findMatchingWave()` in `autoGroupPhotosIntoWaves` rejects existing waves that are date-frozen (`freezeDate < now`), causing every batch of ≤200 photos to create a new wave instead of filling the existing one up to the 1000-photo cap. Since auto-grouping processes historical photos whose season dates are in the past, the created wave is immediately frozen, and the next invocation can never reuse it.

## What Changes

- Remove the `_isWaveFrozen` check from `findMatchingWave()` in `autoGroupPhotosIntoWaves.ts`, replacing it with a narrower check that only skips waves explicitly frozen by the user (`freezeMode === 'FROZEN'`). Date-based auto-freeze should not prevent the auto-grouper from filling its own waves across batches.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auto-group-photos`: The `findOrCreateWave` requirement must clarify that auto-grouping skips only explicitly user-frozen waves, not date-frozen waves. The existing spec's `findOrCreateWave` steps do not mention a freeze check at all — the code added one that the spec didn't require.

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — `findMatchingWave()` function, season-filter loop (~line 307-312)
- **Behavior**: Waves created by auto-grouping will now correctly accumulate up to 1000 photos across multiple invocations, even for past seasons
- **Risk**: Low — the change only affects the internal auto-grouping path; user-facing freeze behavior (comments, photo additions) is unaffected
