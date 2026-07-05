## Context

The `createPhoto` mutation lives in `lambda-fns/controllers/photos/create.ts` and is dispatched via `lambda-fns/index.ts`. Currently, the flow is:

```
createPhoto(uuid, lat, lon, video):
  1. assertValidUuid(uuid, 'uuid')
  2. psql.connect()
  3. Abuse report check (abuseCount > 3 → throw "You are banned")
  4. photoId = uuidv4()  ← server generates ID
  5. reverseGeocode(lat, lon)
  6. INSERT INTO Photos (id, uuid, location, video, ...) VALUES (photoId, ...)
  7. watch(photoId, uuid)
  8. return Photo
```

The GraphQL schema defines `createPhoto(uuid: String!, lat: Float!, lon: Float!, video: Boolean)` — no `photoId` parameter. The query `generateUploadUrl(assetKey, contentType)` generates presigned S3 PUT URLs.

The Photos table has `id` as the primary key (UUID type after migration 20250719120001-replace-integer-ids-with-uuids.js).

## Goals / Non-Goals

**Goals:**
- Add `getPhotoById(photoId: String!)` query handler
- Add optional `photoId` parameter to `createPhoto` mutation with idempotent handling
- Backward compatible: existing clients without `photoId` continue to work
- No database schema changes required

**Non-Goals:**
- Modifying the S3 trigger (`processUploadedImage` Lambda)
- Changing the abuse report check logic
- Adding new database indexes (the primary key index on `Photos.id` is sufficient)
- Modifying the auto-grouping flow

## Decisions

### Decision 1: Add getPhotoById as a device-authenticated query handler

**Why**: The client needs to check photo existence and `active` status before deciding the upload path. The query must only return results when the calling device (`uuid`) matches the device that uploaded the photo, preventing unauthorized discovery of photo metadata.

**Approach**: Create `lambda-fns/controllers/photos/getPhotoById.ts`:

```typescript
export default async function main(photoId: string, uuid: string): Promise<Photo | null> {
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')
  await psql.connect()
  const result = await psql.query(
    `SELECT * FROM "Photos" WHERE "id" = $1 AND "uuid" = $2`,
    [photoId, uuid]
  )
  await psql.clean()
  return result.rows.length > 0 ? plainToClass(Photo, result.rows[0]) : null
}
```

Register in `lambda-fns/index.ts`:
```typescript
getPhotoById: {
  resolver: getPhotoById,
  getArgs: (args) => [args.photoId, args.uuid]
}
```

**Alternatives considered**:
- Use existing `getPhotoDetails(photoId, uuid)`: Also requires two parameters and returns extra data (comments, recognitions). Overkill for a simple existence check — we want a lean lookup during upload.
- Add the query resolver to `lib/resources/resolvers.ts` instead of `index.ts`: The codebase uses `index.ts` for query/mutation handlers, so follow that pattern.

### Decision 2: Require photoId on createPhoto mutation

**Why**: Client needs to pass its pre-generated UUID to the server for deduplication. Making it required ensures the client always sends it — no fallback to server-side generation.

**Approach**: Modify `createPhoto` in `lambda-fns/controllers/photos/create.ts`:

```typescript
export default async function main(
  photoId: string,  // REQUIRED: client-provided photo ID
  uuid: string,
  lat: number,
  lon: number,
  video: boolean
) {
  assertValidUuid(uuid, 'uuid')
  
  await psql.connect()
  
  // Check abuse reports
  const abuseCount = /* ... abuse query ... */
  if (abuseCount > 3) {
    // If photo already exists (idempotent), return it
    const existing = await psql.query(
      `SELECT * FROM "Photos" WHERE "id" = $1`,
      [photoId]
    )
    if (existing.rows.length > 0) {
      await psql.clean()
      return plainToClass(Photo, existing.rows[0])
    }
    throw 'You are banned'
  }
  
  // Attempt insert (primary key constraint prevents duplicates)
  try {
    const result = await psql.query(
      `INSERT INTO "Photos" (...) VALUES (photoId, ...) returning *`,
      [photoId, uuid, lat, lon, video, ...]
    )
    await watch(result.rows[0].id, uuid)
    await psql.clean()
    return plainToClass(Photo, result.rows[0])
  } catch (error) {
    if (error.code === '23505') {  // UNIQUE constraint violation
      // Photo was created concurrently, return existing
      const existing = await psql.query(
        `SELECT * FROM "Photos" WHERE "id" = $1`,
        [photoId]
      )
      await psql.clean()
      return existing.rows.length > 0 ? plainToClass(Photo, existing.rows[0]) : null
    }
    throw error
  }
}
```

Update GraphQL schema:
```graphql
createPhoto(
  photoId: String!   # NEW: required client-provided photo ID
  uuid: String!
  lat: Float!
  lon: Float!
  video: Boolean
): PhotoDetails
```

**Alternatives considered**:
- Optional photoId (backward compatible): Would allow old clients to work but defeats the purpose — they'd generate server-side UUIDs and still get duplicates. Rejected.
- Check for existing photo before attempting insert: Faster for happy path, but race condition possible. Using primary key constraint + error handling is more robust (RAII pattern).
- Return error on duplicate: Not idempotent. Client would need to re-queue, losing the photoId. Rejected.

### Decision 3: Register getPhotoById in both index.ts and resolvers.ts

**Why**: The codebase uses two registration points for GraphQL resolvers.

**Approach**: Add to both:
1. `lambda-fns/index.ts` — the query/mutation handler map
2. `lib/resources/resolvers.ts` — the CDK resolver creation

**Alternatives considered**:
- Only `index.ts`: Might miss CDK provisioning. Safer to add both.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Concurrent `createPhoto` with same photoId could both pass abuse check | Database UNIQUE constraint catches the loser. Both returned photos are valid (both passed abuse check). |
| `getPhotoById` adds latency to upload flow | One extra query (~5ms). Acceptable trade-off for reliability. |
| Backend deployment before client — old clients break | Backward compatible: `photoId` is optional. Old clients omit it and get server-generated ID. |
| New query increases API surface | Minimal risk. Only called by client during upload flow. |
| Primary key violation error handling | Catch PostgreSQL error code `23505` and return existing photo. Standard pattern. |

## Migration Plan

**Deployment order:**
1. Deploy backend change first (backward compatible)
2. Deploy client update (uses new optional `photoId` parameter)

**Rollback:**
- If client has issues: roll back client. Old clients continue using server-side UUID generation.
- If backend has issues: roll back backend. No data loss — duplicate photos can be cleaned up manually.

**Database:** No schema changes required. No migration needed.

## Open Questions

1. Should `getPhotoById` return the full `PhotoDetails` type or a subset? (Current decision: full `PhotoDetails` type for consistency with existing queries.)
2. Should the abuse check be skipped entirely when returning an existing photo by `photoId`, or should it still run? (Current decision: skip abuse check for existing photos — the photo was already created and passed the check at that time.)
