## Context

The `listWaves` query currently sorts waves by `Waves.createdAt DESC`, which means newly-created waves appear first regardless of activity. Users on the waves details screen expect to see the most recently active waves first.

Key finding: `Waves.updatedAt` is already maintained correctly by `_updatePhotosCount.ts`:
```sql
UPDATE "Waves" SET
  "photosCount" = sub.cnt,
  "updatedAt" = sub.last_photo_date,  -- MAX(Photos.createdAt)
```

This field is bumped whenever photos are added/removed, so it accurately reflects wave activity without needing any changes to the data model.

## Goals / Non-Goals

**Goals:**
- Sort waves by most recent activity (`updatedAt`) instead of creation time
- Update the spec to match the new requirement

**Non-Goals:**
- Changing how `updatedAt` is maintained (it's already correct)
- Adding new sort options (this changes the default only)

## Decisions

### Decision 1: Use `Waves.updatedAt` as the sort key

**Rationale:** This field already tracks the most recent photo date in the wave. No new fields, triggers, or complex queries needed.

### Decision 2: Maintain `waveUuid ASC` as tiebreaker

**Rationale:** Ensures deterministic ordering when multiple waves have the same `updatedAt` timestamp (which can happen with rapid photo additions).

## Risks / Trade-offs

- **[No risk]** — `Waves.updatedAt` is already maintained correctly by `_updatePhotosCount.ts`
- **[No breaking change]** — Only affects sort order, not data returned or query shape

## Migration Plan

No migration needed. The field already exists and is maintained.

## Open Questions

None.
