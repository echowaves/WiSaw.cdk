## Why

Wave owners (and facilitators) cannot comment on photos in their own frozen waves, even though they need to manage content — adding context, clarifying descriptions, or responding to comments. The current `_isPhotoInFrozenWave` check blocks all users indiscriminately.

## What Changes

- Allow wave **owner** (`createdBy`) and **facilitator** (via `WaveUsers.role = 'facilitator'`) to comment on photos in their own frozen waves
- Delete path remains strict — unfreezing required as a stop-gap before deleting comments on frozen-wave photos
- Photos are single-wave only, so no cross-wave ambiguity

## Capabilities

### New Capabilities
- `frozen-wave-permissions`: Define permission rules for photo mutations (comments) based on wave ownership and freeze state

### Modified Capabilities
<!-- None — this is a new capability -->

## Impact

- `lambda-fns/controllers/waves/_isPhotoInFrozenWave.ts` → rename to `_isPhotoInFrozenWaveForUser`, add user-role check via `WaveUsers` join
- `lambda-fns/controllers/comments/create.ts` → use new function with uuid parameter
- `lambda-fns/controllers/comments/delete.ts` → keep strict behavior (unfreezing required)
