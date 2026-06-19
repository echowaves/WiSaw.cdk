# Friendships: getFriendshipsList

## Summary

Lists all confirmed friendships for a user with preview photos for each friend.

## Requirements

### R1. Query friendships

The query MUST return all confirmed friendships where the user is either `uuid1` or `uuid2`.

**Before:**
```sql
SELECT * FROM "Friendships"
WHERE "uuid1" = $1 OR "uuid2" = $1
```

**After:**
```sql
SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *
FROM "Friendships"
WHERE "uuid1" = $1 OR "uuid2" = $1
ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC
```

### R2. Extract friend UUID

For each friendship `(uuid1, uuid2)`:
- If `uuid = uuid1`, friend = `uuid2`
- If `uuid = uuid2`, friend = `uuid1`

### R3. Load photos per friend

Photos are loaded using:
```sql
WHERE "Photos"."uuid" = ANY($1)  -- $1 = unique friend UUIDs
```

Where `Photos.uuid` is the photo owner's UUID.

### R4. Return unique friendships

Each friendship pair should appear only once in the result, with the most recent entry preserved.

## Scenarios

### S1. Bidirectional friendship deduplication

**Given:**
- Friendship `(uuid1=A, uuid2=B, createdAt=2026-01-01)` exists
- Friendship `(uuid1=B, uuid2=A, createdAt=2026-01-02)` exists

**When:**
- User A queries `getFriendshipsList(A)`

**Then:**
- Exactly 1 entry for friend B is returned
- The entry uses `createdAt=2026-01-02` (most recent)
- Photos returned are B's photos

### S2. Single-direction friendship

**Given:**
- Friendship `(uuid1=A, uuid2=B, createdAt=2026-01-01)` exists

**When:**
- User A queries `getFriendshipsList(A)`

**Then:**
- 1 entry for friend B is returned
- Photos returned are B's photos

### S3. Pending friendship (not confirmed)

**Given:**
- Friendship `(uuid1=A, uuid2=NULL, createdAt=2026-01-01)` exists

**When:**
- User A queries `getFriendshipsList(A)`

**Then:**
- Friendship is skipped (uuid2 is NULL)
- No entry for pending friendship

### S4. Self-friendship (data anomaly)

**Given:**
- Friendship `(uuid1=A, uuid2=A, createdAt=2026-01-01)` exists

**When:**
- User A queries `getFriendshipsList(A)`

**Then:**
- Friendship is filtered out
- No entry for self-friendship

## Schema

```typescript
interface Friendship {
  friendshipUuid: string;
  uuid1: string;
  uuid2: string | null;
  photos: Photo[];
  photosCount: number;
  createdAt: string;
}
```
