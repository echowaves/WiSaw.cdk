# Design: Fix getFriendshipsList Duplicate Photos Bug

## Problem Statement

`getFriendshipsList(uuid)` returns duplicate entries for the same friend when bidirectional friendships exist in the database.

## Root Cause

1. Friendships can be stored in both directions:
   - `(uuid1=A, uuid2=B)` - A initiated friendship with B
   - `(uuid1=B, uuid2=A)` - B initiated friendship with A

2. Current query returns both rows:
```sql
SELECT * FROM "Friendships"
WHERE "uuid1" = $1 OR "uuid2" = $1
```

3. Both rows extract the same `friendUuid` (the other person), but both are returned in the result

4. Photos are loaded correctly per friend, but the friendship list has duplicates

## Solution

Deduplicate friendships at query time using PostgreSQL's `DISTINCT ON` with normalized pair:

```sql
SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *
FROM "Friendships"
WHERE "uuid1" = $1 OR "uuid2" = $1
ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC
```

This returns each unique friendship pair only once, keeping the most recent one.

## Implementation

### File: `lambda-fns/controllers/friendships/getFriendshipsList.ts`

**Current code (lines 12-17):**
```typescript
const friendships =
(await psql.query(`
  
  SELECT *
      FROM "Friendships"
      WHERE "uuid1" = $1
      OR "uuid2" = $1
    `, [uuid])
  ).rows
```

**Fixed code:**
```typescript
const friendships =
(await psql.query(`
  
  SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *
      FROM "Friendships"
      WHERE "uuid1" = $1
      OR "uuid2" = $1
      ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC
    `, [uuid])
  ).rows
```

This change:
- Deduplicates friendships by normalized pair
- Keeps the friendship with the most recent `createdAt`
- Ensures each friend appears only once in results

## Testing

### Test Cases

1. **Duplicate friendships filtered:**
   - Setup: Both `(A,B)` and `(B,A)` exist with different timestamps
   - Query: `getFriendshipsList(A)`
   - Expected: One entry for B, using the later `createdAt`

2. **Single-direction friendships:**
   - Setup: Only `(A,B)` exists
   - Query: `getFriendshipsList(A)`
   - Expected: One entry for B

3. **Pending friendships:**
   - Setup: `(A,NULL)` exists
   - Query: `getFriendshipsList(A)`
   - Expected: Entry for NULL (pending), skipped in photos query

## Performance

The `DISTINCT ON` clause requires sorting, which has O(n log n) complexity. For typical friendship counts (<1000), this is negligible.

Index on `(uuid1, uuid2, "createdAt")` or `(uuid2, uuid1, "createdAt")` can help if performance becomes an issue.
