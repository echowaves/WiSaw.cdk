## Why

The `deletePhoto` controller blocks deletion of any photo that is in a frozen wave, regardless of who is calling. This contradicts the design decision that wave owners can override freeze for photo removal. The wave-scoped `removePhotoFromWave` correctly allows owner override, but the global `deletePhoto` (soft-delete) does not — creating an inconsistency where an owner can unlink a photo from their frozen wave but cannot soft-delete it globally.

## What Changes

- Modify `deletePhoto` to allow wave owners to soft-delete photos that are in their frozen waves, while continuing to block non-owners.

## Capabilities

### New Capabilities

- `owner-frozen-photo-delete`: Allow wave owners to bypass the frozen-wave guard when globally soft-deleting a photo that is in their frozen wave.

### Modified Capabilities

## Impact

- `lambda-fns/controllers/photos/delete.ts` — needs role-aware frozen wave check instead of blanket block
- `lambda-fns/controllers/waves/_isPhotoInFrozenWave.ts` — may need a variant that returns the wave UUID for role lookup, or the logic moves inline into `deletePhoto`
