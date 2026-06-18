# proposal.md

## Why

The `feedForFriend` backend resolver in `lambda-fns/controllers/friendships/feedForFriend.ts` has a critical SQL bug that prevents it from returning any photos.

**Current buggy query:**
```sql
SELECT p.*
FROM "Photos" p
WHERE
  p."uuid" = $1  -- $1 is friendUuid
AND p.active = true
```

This query looks for photos **where the photo's uuid equals the friend's user uuid**, which is wrong. Photos are not owned by users in this way - photos have their own UUIDs.

**Expected behavior:** The query should find photos where the friend is a watcher (i.e., photos shared with the friend through the `Watchers` table).

**Evidence of bug:**
1. User clicks on photo in friend card → navigates to `/friendships/[friendUuid]` with correct params
2. `fetchFriendPhotos` is called with valid `friendUuid` parameter
3. Backend returns empty photos array
4. User sees "No Photos Yet" screen even when friend has shared photos

**Test scenario:**
- User A and User B are friends
- User B has shared 3 photos with User A
- User A clicks on photo strip in User B's friend card
- Expected: Shows 3 photos
- Actual: Shows "No Photos Yet"

---

## What Changes

**File**: `lambda-fns/controllers/friendships/feedForFriend.ts`

**Change:** Update the SQL query to JOIN with the `Watchers` table instead of filtering photos by uuid.

**Before:**
```typescript
const query = `
  SELECT p.*
  FROM "Photos" p
  WHERE
    p."uuid" = $1
  AND p.active = true
  ${searchClause}
  ORDER BY p.${sortField} ${direction}
  LIMIT $2
  OFFSET $3
`
```

**After:**
```typescript
const query = `
  SELECT p.*
  FROM "Photos" p
  INNER JOIN "Watchers" w
    ON p.id = w."photoId"
  WHERE
    w.uuid = $1
  AND p.active = true
  ${searchClause}
  ORDER BY p.${sortField} ${direction}
  LIMIT $2
  OFFSET $3
`
```

This matches the pattern used in `feedForWatcher.ts` which correctly finds photos for a specific user.

---

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `friend-photo-feed`: Now correctly returns photos shared with a friend
- `feedForFriend`: Fixed SQL query to find shared photos

---

## Impact

- **Code**: `lambda-fns/controllers/friendships/feedForFriend.ts` - 1 line change (JOIN addition)
- **API**: No API changes - same query signature
- **Severity**: CRITICAL - Friends list photo strips are completely broken
- **Database**: Uses existing `Watchers` table structure
- **Dependencies**: No new dependencies

---

## Sequencing

**Priority**: HIGH - Blocks friend photo feed functionality
**Prerequisites**: None
**Blocked by**: None

This fix can be deployed independently and will immediately restore friend photo feed functionality.
