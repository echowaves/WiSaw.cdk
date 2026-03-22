## Why

The `addPhotoToWave` controller currently throws an error (`Photo is already in a wave`) when a photo already belongs to a different wave. This forces users to manually remove the photo from its current wave before adding it to a new one. Instead, the operation should automatically move the photo by removing it from the old wave first, providing a seamless experience.

## What Changes

- Modify `addPhotoToWave` to automatically remove the photo from its current wave (if any) before inserting it into the target wave
- Update the `photosCount` on both the old wave (decrement) and the new wave (increment)
- Remove the "Photo is already in a wave" error — the operation becomes an implicit move

## Capabilities

### New Capabilities
- `wave-photo-auto-move`: When adding a photo to a wave, automatically remove it from any other wave it currently belongs to instead of throwing an error

### Modified Capabilities

## Impact

- **Lambda code**: `lambda-fns/controllers/waves/addPhoto.ts` — replace the error-throwing block with a DELETE + _updatePhotosCount for the old wave
- **No API changes**: Same GraphQL mutation, same parameters, same return type
- **No database changes**: No migrations needed
- **Behavior change**: Callers that previously caught "Photo is already in a wave" errors will no longer receive them
