## Context

The `removePhotoFromWave` GraphQL mutation is defined in [graphql/schema.graphql](../../graphql/schema.graphql) as returning `Boolean!`. The resolver at [lambda-fns/controllers/waves/removePhoto.ts](../../lambda-fns/controllers/waves/removePhoto.ts) currently fetches the full `Wave` row after deleting the `WavePhotos` association and returns it via `plainToClass(Wave, ...)`. AppSync cannot serialize a `Wave` object as a `Boolean`, causing a runtime error for all clients calling this mutation.

The sibling mutation `addPhotoToWave` correctly returns `true`.

## Goals / Non-Goals

**Goals:**
- Make `removePhotoFromWave` return a boolean (`true`) to match the GraphQL schema.
- Remove the dead `SELECT` query and unused imports.

**Non-Goals:**
- Changing the GraphQL schema or API contract.
- Altering the deletion logic or `_updatePhotosCount` behavior.

## Decisions

1. **Return `true` after successful deletion** — mirrors the `addPhotoToWave` pattern already established in the codebase. No alternatives needed; this is a straightforward contract-compliance fix.
2. **Remove the post-delete `SELECT` query** — the query result is unused by the correct return type, so it's dead code.
3. **Remove unused imports** — `plainToClass` and `Wave` are no longer referenced.

## Risks / Trade-offs

- **[Low] Clients depending on the error shape** → No mitigation needed; the current behavior is a crash, not a feature. Fixing it is strictly additive for clients.
