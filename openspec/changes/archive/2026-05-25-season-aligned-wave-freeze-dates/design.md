## Context

Auto-grouped waves use `freezeMode=AUTO` with `splashDate`/`freezeDate` controlling the unfrozen window. Currently both are set to the photo's `createdAt` (past), making waves instantly frozen. The `_isWaveDateFrozen` logic (`now > freezeDate` → frozen) is correct — the problem is the dates being set wrong at creation time.

Season keys (e.g., `2026-SPRING`) already exist in `_seasonKey.ts` and are used for wave naming and season-boundary detection. We need to derive exact calendar boundaries from these keys.

## Goals / Non-Goals

**Goals:**
- Auto-grouped waves are unfrozen during their season and freeze automatically when the season ends
- `findMatchingWave` never reuses a frozen wave (manual or auto-frozen)
- Existing waves are unaffected

**Non-Goals:**
- Migrating existing wave dates
- Changing manually-created wave defaults (still `now + 30 days`)
- Changing the freeze mode system or `_isWaveDateFrozen` logic

## Decisions

### Decision: Add `getSeasonBoundaries` to `_seasonKey.ts`

Parse the `YYYY-SEASON` key to compute exact start/end timestamps:

```
WINTER Y → Dec 1 Y 00:00:00.000  →  last moment of Feb Y+1
SPRING Y → Mar 1 Y 00:00:00.000  →  last moment of May Y
SUMMER Y → Jun 1 Y 00:00:00.000  →  last moment of Aug Y
FALL   Y → Sep 1 Y 00:00:00.000  →  last moment of Nov Y
```

Use `moment().endOf('month')` for freeze dates to handle leap years correctly (Feb 28 vs 29).

**Why in `_seasonKey.ts`?** It already owns season key computation and formatting. Season boundaries are the natural complement.

**Alternative considered:** Compute boundaries inline in auto-group. Rejected — this is reusable logic that should be tested independently.

### Decision: Filter frozen waves in `findMatchingWave` loop

Add `_isWaveFrozen(wave)` check in the existing code loop that filters by season key. The `SELECT *` already returns all needed fields (`splashDate`, `freezeDate`, `freezeMode`).

```
for (const wave of result.rows) {
  if (wave.splashDate != null) {
    const waveSeasonKey = getSeasonKey(moment(wave.splashDate))
    if (waveSeasonKey === photoSeasonKey && !_isWaveFrozen(wave)) {  // ← add check
      return wave
    }
  }
}
```

**Why not filter in SQL?** The frozen logic involves `freezeMode` enum + date comparisons. Replicating `_isWaveFrozen` in SQL would duplicate logic. The result set is small (few waves per user/groupingLevel/geo), so code-level filtering is fine.

### Decision: No migration

Old auto-grouped waves have `splashDate = freezeDate = photoDate` (instantly frozen). With the frozen-wave skip in `findMatchingWave`, these waves will simply be skipped and new waves with correct dates will be created. This is self-healing — no migration needed.

## Risks / Trade-offs

- **[Old waves accumulate duplicates]** → Old frozen waves are skipped, so new waves get created for the same locality+season. This is acceptable — old waves were already frozen and non-functional. Over time, only the correctly-dated waves will be active.
- **[Season boundary precision]** → `freezeDate` uses `endOf('month')` which gives `23:59:59.999`. The `_isWaveDateFrozen` check is `freezeDate < now` (strict less-than), so a photo uploaded at `23:59:59.999` on the last day would still see the wave as unfrozen. This is acceptable — 1ms precision is sufficient.
