## Why

The photo upload system on the client side cannot guarantee idempotent retries. When a network timeout occurs during `createPhoto`, the client doesn't know whether the server created the photo record — leading to duplicate photos in the database. The server currently generates the photo ID internally, giving the client no way to deduplicate or look up existing photos.

## What Changes

- **Require client-provided photoId**: `createPhoto` mutation requires `photoId` parameter. The server uses it as the primary key. If a photo with that ID already exists, the server returns the existing photo (idempotent) instead of creating a duplicate.
- **Add `getPhotoById` query**: New GraphQL query to look up a photo by its ID and return its `active` status and metadata. Used by the client to determine whether to skip creation, skip upload, or proceed normally.
- **Breaking change**: `photoId` is required. Old clients without `photoId` will fail at the GraphQL level. Backend change must deploy before client updates.

## Capabilities

### New Capabilities
- `photo-lookup`: Query photos by ID to check existence and activation status

### Modified Capabilities
- `photo-upload`: `createPhoto` mutation requires `photoId` parameter with idempotent duplicate handling

## Impact

**Backend code:**
- `graphql/schema.graphql` — add `photoId` to `createPhoto` mutation params, add `getPhotoById` query
- `lambda-fns/controllers/photos/create.ts` — accept optional `photoId`, idempotent handling
- `lambda-fns/controllers/photos/getPhotoById.ts` — new controller (lookup by ID, return active status)
- `lambda-fns/index.ts` — register new query handler

**Database:** No schema changes required. `Photos.id` is already the primary key with UNIQUE constraint.

**Deployment:** Backend change is **breaking** — `photoId` is required. Client must deploy after backend update.
