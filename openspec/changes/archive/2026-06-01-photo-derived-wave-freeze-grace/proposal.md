## Why

Auto-grouped waves currently use season boundary dates for `splashDate` and `freezeDate`. This means a wave created in March for a photo from January freezes at the end of the winter season (February), even though the last photo was added months earlier. Users lose the ability to add photos to recently-active waves because the freeze window is determined by calendar seasons, not by actual photo activity.

The fix shifts freeze timing to be photo-derived: `freezeDate` becomes one month after the most recent photo's `createdAt`, giving users a consistent grace period regardless of when photos were taken.

## What Changes

- New auto-grouped waves: `splashDate` = first photo's `createdAt` (instead of season start)
- New auto-grouped waves: `freezeDate` = first photo's `createdAt` + 1 month (instead of season end)
- Adding photos to existing auto-grouped waves: `freezeDate` shifts to `MAX(photo.createdAt)` + 1 month (instead of just `MAX(photo.createdAt)`)
- Existing waves are untouched — no migration needed
- `splashDate` for new waves changes from season start to first photo date

## Capabilities

### Modified Capabilities

- `auto-group-photos`: Wave date derivation logic — splashDate and freezeDate are photo-derived with a 1-month grace period instead of season-aligned
- `season-wave-boundaries`: `getSeasonBoundaries` is no longer used for new wave creation dates; season boundaries remain used for season key computation only

## Impact

- **Backend**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — `createWave()` call site passes photo-derived dates instead of season dates
- **Backend**: `lambda-fns/controllers/waves/_updatePhotosCount.ts` — `freezeDate` update adds 1-month interval
- **Tests**: `tests/auto-group.js` — scenarios about season-aligned dates need updating
- **APIs**: No schema changes — internal behavior only
- **Data**: No migration — old waves keep their season-based dates
