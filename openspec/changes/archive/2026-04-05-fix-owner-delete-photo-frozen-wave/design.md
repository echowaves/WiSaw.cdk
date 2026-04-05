## Context

`deletePhoto` (in `lambda-fns/controllers/photos/delete.ts`) soft-deletes a photo by setting `active = false`. A cross-cutting guard was added to reject deletion if the photo is in a frozen wave, using `_isPhotoInFrozenWave(photoId)`. This is a blanket boolean check with no awareness of who is calling. Meanwhile, `removePhotoFromWave` (wave-scoped unlink) correctly allows the wave owner to bypass freeze. The two controllers are inconsistent.

## Goals / Non-Goals

**Goals:**
- Allow wave owners to soft-delete photos that are in their frozen waves
- Maintain the freeze guard for all non-owner callers

**Non-Goals:**
- Changing comment freeze behavior (comments remain globally blocked on frozen wave photos)
- Changing `removePhotoFromWave` behavior (already correct)

## Decisions

### 1. Inline the frozen-wave check with role awareness in `deletePhoto`

**Decision**: Replace the blanket `_isPhotoInFrozenWave(photoId)` call with an inline query that fetches both the frozen status and the wave UUID, then checks if the caller is the owner of that wave. If they are, allow the deletion; otherwise, block it.

**Alternatives considered**:
- Add a `_isPhotoInFrozenWaveForNonOwner(photoId, uuid)` utility — adds a new function for a single call site; unnecessary abstraction
- Pass `uuid` into the existing `_isPhotoInFrozenWave` — changes its signature and semantics for all callers (comments don't need role awareness)

**Rationale**: The role-aware check is only needed in `deletePhoto`. Keeping it inline avoids polluting shared utilities. The existing `_isPhotoInFrozenWave` remains clean for comment controllers where the blanket block is correct.

### 2. Query pattern

**Decision**: Query `WavePhotos` JOIN `Waves` JOIN `WaveUsers` in a single query to get `frozen`, `endDate`, and `role` for the caller. If the photo is not in any wave, proceed normally. If it's in a frozen wave and the caller is the owner, proceed. Otherwise, block.

**Rationale**: Single query instead of multiple round-trips. The JOINs are all on indexed primary/foreign keys.

## Risks / Trade-offs

- **[Slightly more complex query in deletePhoto]** → One JOIN more than the current `_isPhotoInFrozenWave`. Negligible performance impact on indexed keys.
- **[Owner can soft-delete photos from frozen waves globally]** → This is the intended behavior. The photo disappears from the global feed AND the frozen wave. This is a stronger action than unlink (which only removes from wave). The owner should understand this distinction. Client-side UX should differentiate the two options.
