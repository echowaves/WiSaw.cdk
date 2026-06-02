## Context

Auto-grouped waves use `splashDate` and `freezeDate` to control their unfrozen window. Currently both dates are derived from season boundaries via `getSeasonBoundaries(seasonKey)`. The `freezeDate` is updated on each photo batch via `_updatePhotosCount` which sets it to `MAX(photo.createdAt)`.

The problem: season boundaries don't align with actual photo activity. A wave with its last photo in November freezes in February (season end) or immediately (if historical). Users expect a consistent grace period after their last photo, not a calendar-dependent one.

## Goals / Non-Goals

**Goals:**
- New waves get `splashDate` = first photo's `createdAt`
- New waves get `freezeDate` = first photo's `createdAt` + 1 month
- Adding photos shifts `freezeDate` to `MAX(photo.createdAt)` + 1 month
- Old waves remain untouched

**Non-Goals:**
- No migration of existing waves
- No API/schema changes
- No configurable grace period (hardcoded 1 month)
- No capping of grace period to season boundaries
- No changes to `splashDate` after wave creation

## Decisions

### Decision 1: splashDate = first photo's createdAt

**Rationale**: The splash date represents when the wave "opens" — it should correspond to when the first photo in the wave was taken, not an arbitrary season start. This makes the wave's timeline meaningful.

### Decision 2: freezeDate = MAX(photo.createdAt) + 1 month (hardcoded)

**Rationale**: A fixed 1-month grace period gives users a predictable window to add/remove photos. No capping means an active wave stays open as long as photos keep arriving — which is the desired behavior per user feedback.

### Decision 3: No migration for old waves

**Rationale**: Old waves with season-based dates will naturally freeze according to their existing dates. New waves get the new behavior. They coexist without issues. Old waves that are re-autogrouped (e.g., after being skipped) will have new waves created with the new date logic.

### Decision 4: Only modify two files

**Rationale**: The change is surgical:
1. `autoGroupPhotosIntoWaves.ts` — change the `createWave` call to pass photo-derived dates
2. `_updatePhotosCount.ts` — add `INTERVAL '1 month'` to the freezeDate update

### Decision 5: Season boundaries still used for season key computation

**Rationale**: `getSeasonKey()` and `getSeasonBoundaries()` remain in use for naming waves (e.g., "New York, Spring 2026") and for determining season boundaries that split waves. Only the date assignment changes.

## Risks / Trade-offs

**[Active waves stay open indefinitely]** → If photos arrive every few weeks, the wave never freezes. This is intentional — an active wave should stay open.

**[Old waves have inconsistent behavior]** → Old waves use season dates, new waves use photo dates. This is acceptable — old waves will naturally phase out as they're consumed or manually frozen.

**[Test scenarios need updating]** → Tests asserting season-aligned dates must be updated to assert photo-derived dates. Low risk, straightforward updates.
