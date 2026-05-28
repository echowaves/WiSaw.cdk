## Context

The `autoGroupPhotosIntoWaves` mutation creates multiple waves in rapid succession within a single batch. All waves receive `createdAt = moment()` and `updatedAt = moment()`, producing identical or near-identical timestamps. The `listWaves` query paginates with `LIMIT/OFFSET` sorted by `updatedAt`, and even with a UUID tiebreaker, the `updatedAt` value can shift between page requests because `_updatePhotosCount` and `closeWave` bump it to `moment()` each time they run. This causes duplicate waves across pages.

The underlying photo `createdAt` timestamps (device-originated) are naturally unique and immutable — they reflect when the photo was actually taken, not when the server processed it.

## Goals / Non-Goals

**Goals:**
- Eliminate duplicate waves in paginated results by ensuring auto-grouped waves have distinct, stable timestamps
- Make wave `createdAt` and `updatedAt` semantically meaningful during auto-grouping: `createdAt` = first photo's date, `updatedAt` = last photo's date
- Track `freezeDate` from actual photo dates during auto-grouping rather than season-end boundaries

**Non-Goals:**
- Changing timestamp behavior for non-auto-grouping operations (manual create, rename, addPhoto, update) — these continue using `moment()`
- Migrating existing waves — they will be wiped and recreated by clients
- Replacing `LIMIT/OFFSET` with cursor-based pagination
- Changing `splashDate` calculation (remains season-start boundary)
- Changing `_isWaveFrozen` logic

## Decisions

**Derive `createdAt`/`updatedAt` from photo dates during auto-grouping**

`createWave()` currently receives no photo date context. It will be extended to accept a `photoCreatedAt` parameter. During auto-grouping, the first photo's `createdAt` is passed in, giving the wave a meaningful creation timestamp. For non-auto-grouping callers (`create.ts`), `moment()` continues to be used.

**Alternative considered: Add a separate `lastPhotoDate` column for sorting** — rejected because it adds schema complexity; reusing `updatedAt` for the photo-derived value during auto-grouping is sufficient since these waves are only created/modified by auto-grouping.

**`_updatePhotosCount` recalculates `updatedAt` and `freezeDate` from photo data**

The existing `_updatePhotosCount` function already runs a subquery against `WavePhotos JOIN Photos`. It will be extended to also compute `MAX("Photos"."createdAt")` and set both `updatedAt` and `freezeDate` to that value. This ensures timestamps stay correct as photos are added incrementally across batches.

**Alternative considered: Recalculate only in `closeWave()`** — rejected because a wave may span multiple auto-group invocations; `_updatePhotosCount` is called after every flush and naturally captures the latest photo date.

**`closeWave()` stops setting `updatedAt = moment()`**

The name-refinement UPDATE in `closeWave()` currently sets `updatedAt = moment()`. Since `_updatePhotosCount` (called via `flushWavePhotos` just before `closeWave`) already maintains the correct photo-derived `updatedAt`, the `closeWave` UPDATE will omit the `updatedAt` assignment.

**Set `freezeDate = photoCreatedAt` at creation, then track MAX**

At wave creation during auto-grouping, `freezeDate` is set to the first photo's `createdAt`. As more photos are added, `_updatePhotosCount` pushes `freezeDate` forward to `MAX(photo.createdAt)`. This means:
- A wave only becomes "frozen" (by date check) after the date of its last photo passes
- `findMatchingWave` checks `freezeMode !== 'FROZEN'`, not `_isWaveFrozen`, so auto-grouping can still add photos to a wave whose `freezeDate` has passed — this is correct behavior since it will push `freezeDate` forward

## Risks / Trade-offs

- **[Sort order changes for auto-grouped waves]** → Waves will sort by when their photos were taken, not when the server processed them. This is actually more intuitive for users.
- **[Subquery cost in `_updatePhotosCount`]** → Adding `MAX("Photos"."createdAt")` to the existing subquery is negligible — it's already joining the same tables.
- **[`freezeDate` tighter than season boundary]** → A wave with last photo from July 15 becomes frozen on July 16, not August 31. But `findMatchingWave` bypasses `_isWaveFrozen`, so auto-grouping will still reuse the wave and push `freezeDate` forward. Manual `addPhoto` checks `_isWaveFrozen` and will reject additions after the last photo date — this is acceptable behavior.
