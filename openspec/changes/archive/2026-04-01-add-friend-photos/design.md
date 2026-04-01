## Context

The app has friendships (bidirectional, stored as `uuid1`/`uuid2` in `Friendships` table) and photos (owned by `Photos.uuid`). Currently friendships only support chat. The `listWaves` controller already implements the "list items with up to 5 preview photos" pattern using `ROW_NUMBER() OVER (PARTITION BY ...)`, and `feedForWave` implements the paginated photo feed pattern. Both patterns are reused here.

## Goals / Non-Goals

**Goals:**
- Let users browse a friend's photos via a paginated feed with search and sorting.
- Show preview photos in the friendships list (same pattern as waves).
- Add sorting to `feedForWave` for consistency.
- Validate friendship existence before granting photo access.

**Non-Goals:**
- Privacy controls beyond friendship validation (no blocking, no per-photo visibility).
- Modifying the friendship creation/acceptance flow.
- Adding a friend's photo count to the Friendship type (can be added later).

## Decisions

**1. Friendship validation query**
Before returning a friend's photos, `feedForFriend` validates an accepted friendship exists:
```sql
SELECT 1 FROM "Friendships"
WHERE "uuid2" IS NOT NULL
  AND (("uuid1" = $1 AND "uuid2" = $2) OR ("uuid1" = $2 AND "uuid2" = $1))
LIMIT 1
```
The `uuid2 IS NOT NULL` check ensures only accepted friendships grant access, not pending requests. Alternative: skip validation and just query photos — rejected because it would allow any user to view any other user's photos by guessing UUIDs.

**2. Friend UUID extraction for preview photos**
In `getFriendshipsList`, the "other side" of each friendship is computed as:
`friend_uuid = (uuid1 == my_uuid) ? uuid2 : uuid1`. Pending friendships (uuid2 = null) are skipped for photo loading since there's no friend to show photos for.

**3. Preview photos batch query**
Same pattern as `listWaves`: collect all friend UUIDs, then single batch query:
```sql
SELECT uuid AS "friendUuid", ranked.*
FROM (
  SELECT "Photos".*, ROW_NUMBER() OVER (PARTITION BY "Photos"."uuid" ORDER BY "updatedAt" DESC) AS row_num
  FROM "Photos"
  WHERE "Photos"."uuid" = ANY($1) AND "Photos"."active" = true
) ranked
WHERE row_num <= 5
```

**4. Sorting whitelist (shared across `feedForWave` and `feedForFriend`)**
Reuse the `ALLOWED_SORT_FIELDS` / `ALLOWED_DIRECTIONS` pattern from `listWaves`:
- Fields: `createdAt`, `updatedAt` (no `name` — photos don't have names)
- Directions: `asc`, `desc`
- Defaults: `updatedAt` / `desc` (preserves current `feedForWave` behavior)
- Invalid values throw an error.

**5. `feedForFriend` controller placement**
Place in `lambda-fns/controllers/friendships/feedForFriend.ts` since it's a friendship-scoped operation, not a general photo operation.

## Risks / Trade-offs

- **[Performance of preview photos query]** → Partitioned `ROW_NUMBER()` query over `Photos` by UUID. `Photos.uuid` is indexed. Same pattern works well for waves. At scale, could add a composite index on `(uuid, active, updatedAt DESC)` if needed.
- **[Friendship validation adds a query per feed request]** → One extra `SELECT 1 ... LIMIT 1` on indexed columns (`uuid1`, `uuid2`). Negligible cost, required for security.
- **[feedForWave backward compatibility]** → New `sortBy`/`sortDirection` params are optional with defaults matching current behavior (`updatedAt DESC`). No breaking change.
