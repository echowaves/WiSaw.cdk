## Why

Wave owners should have full control over their waves at all times, regardless of freeze status (date-based or mode-based). Currently, frozen waves block owners from adding photos, updating wave details, and merging waves — operations that `removePhoto` already correctly allows for owners.

## What Changes

- **addPhoto**: Allow wave owner to add/remove photos from frozen waves (matching existing `removePhoto` behavior)
- **update**: Remove date-freeze restriction on wave updates for owners (owners can modify any field, including freezeDate and other properties)
- **mergeWaves**: Allow merging of frozen waves when the user owns both source and target waves

## Capabilities

### New Capabilities
<!-- None — this modifies existing behavior in existing capabilities -->

### Modified Capabilities
- `waves`: Owner operations on frozen waves should be permitted (addPhoto, update, merge)

## Impact

- `lambda-fns/controllers/waves/addPhoto.ts`
- `lambda-fns/controllers/waves/update.ts`
- `lambda-fns/controllers/waves/mergeWaves.ts`
- No API or schema changes — behavior change only within existing controllers
