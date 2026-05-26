## Context

`autoGroupPhotosIntoWaves` processes ungrouped photos in batches of 200 (the `BATCH_LIMIT`). For each batch, `findMatchingWave()` searches for an existing wave matching the photo's locality, season, and grouping level. It filters candidates in code with:

```typescript
if (waveSeasonKey === photoSeasonKey && !_isWaveFrozen(wave)) {
    return wave
}
```

`_isWaveFrozen` returns `true` when:
- `freezeMode === 'FROZEN'` (explicitly frozen by user), OR
- `freezeMode` is `AUTO` (default) and `freezeDate < now`

Auto-grouped waves are created with season-based dates (e.g., Summer 2024 → `freezeDate = 2024-08-31`). Since auto-grouping typically processes historical photos, these waves are immediately date-frozen upon creation. The next batch invocation finds the wave but rejects it as frozen, creating a duplicate wave. This caps all waves at ≤200 photos (one batch).

## Goals / Non-Goals

**Goals:**
- Allow `findMatchingWave` to reuse auto-created waves across batches regardless of date-based freeze state
- Preserve explicit user freeze (`freezeMode = 'FROZEN'`) as a hard block even for auto-grouping

**Non-Goals:**
- Changing user-facing freeze behavior (comments, manual photo additions)
- Changing the batch limit or max photos per wave constants
- Adding a new freeze mode or database column

## Decisions

### Decision: Replace `_isWaveFrozen` with `freezeMode !== 'FROZEN'` in `findMatchingWave`

**Choice**: Change the filter condition from `!_isWaveFrozen(wave)` to `wave.freezeMode !== 'FROZEN'`.

**Rationale**: The freeze system has three modes:
- `AUTO` (default) — date-based freeze for user-facing operations
- `FROZEN` — explicit user lock
- `UNFROZEN` — explicit user unlock

For auto-grouping, only explicit user freeze should block wave reuse. Date-based freeze is irrelevant because auto-grouping is the system itself building waves from historical data — it should be able to fill its own waves.

**Alternatives considered**:
1. *Remove freeze check entirely* — rejected because a user who explicitly freezes a wave should have that respected, even by auto-grouping
2. *Add a parameter to `_isWaveFrozen` to skip date checks* — overengineered for a single call site
3. *Change `_isWaveFrozen` globally* — would break user-facing freeze semantics

## Risks / Trade-offs

- **[Risk] `freezeMode` column might be NULL for older waves** → The condition `wave.freezeMode !== 'FROZEN'` treats NULL as "not frozen," which is correct — NULL means AUTO mode, and we want to allow auto-grouping into AUTO-mode waves regardless of date
- **[Risk] User explicitly freezes a wave, then auto-grouping skips it, creating a duplicate** → This is correct and desired behavior — the user intentionally locked the wave
