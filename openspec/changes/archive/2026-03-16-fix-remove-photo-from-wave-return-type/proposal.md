## Why

The `removePhotoFromWave` GraphQL mutation is defined to return `Boolean!` in the schema, but the resolver returns a full `Wave` object instead. This causes a serialization error on the client: `Can't serialize value (/removePhotoFromWave) : Expected type 'Boolean' but was 'LinkedHashMap'.` The mutation is unusable until this is fixed.

## What Changes

- Fix the `removePhotoFromWave` controller to return `true` (a boolean) instead of returning a `Wave` object, aligning with the GraphQL schema definition and matching the pattern used by `addPhotoToWave`.
- Remove the unnecessary `SELECT` query that fetches the wave after deletion, and remove unused imports (`plainToClass`, `Wave` model).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

_(none — this is a bug fix to align implementation with the existing schema contract, no spec-level behavior changes)_

## Impact

- **Code**: `lambda-fns/controllers/waves/removePhoto.ts` — return type and implementation change.
- **APIs**: No schema change. The mutation already declares `Boolean!`; the resolver will now comply.
- **Dependencies**: None.
- **Systems**: AppSync GraphQL API — the mutation will start working correctly for clients.
