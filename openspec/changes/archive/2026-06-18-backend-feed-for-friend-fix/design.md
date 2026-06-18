# design.md

## Context

The `feedForFriend` resolver is a GraphQL query that returns photos shared with a specific friend. It's used by:
- `FriendCard` component - to show recent photos in the friend card photo strip
- `FriendDetail` screen - to show the full photo feed

The resolver receives `uuid` (current user) and `friendUuid` (the friend whose photos to show) and should return photos that the friend has shared with the current user.

The backend uses a PostgreSQL database with the following relevant tables:

### Photos Table
```sql
Photos {
  id: serial PK
  uuid: string
  location: object
  commentsCount: bigint
  watchersCount: bigint
  createdAt: timestamp
  updatedAt: timestamp
  active: boolean
  video: boolean
  width?: number
  height?: number
}
```

### Watchers Table
```sql
Watchers {
  id: serial PK
  photoId: integer FK -> Photos.id
  uuid: string (the user who is watching/has access to this photo)
}
```

The relationship is: **Photos** (1) <- (N) **Watchers** (N) -> (1) **Users**

A photo is "shared" with a user when there's a row in the `Watchers` table linking the photo to that user's UUID.

---

## Existing Patterns

### feedForWave
Uses JOIN to find photos in a wave:
```typescript
const query = `
  SELECT p.*
  FROM "Photos" p
  INNER JOIN "WavePhotos" wp
    ON p.id = wp."photoId"
  WHERE
    wp."waveUuid" = $1
  AND p.active = true
  ...
`
```

### feedForWatcher
Uses JOIN to find photos for a watcher:
```typescript
const query = `
  SELECT p.*
  FROM "Photos" p
  INNER JOIN "Watchers" w
    ON p.id = w."photoId"
  WHERE
    w.uuid = $1
  AND p.active = true
  ...
`
```

### feedForFriend (BROKEN)
Incorrectly filters photos by uuid:
```typescript
const query = `
  SELECT p.*
  FROM "Photos" p
  WHERE
    p."uuid" = $1  -- BUG: $1 is friendUuid, not photo uuid
  AND p.active = true
  ...
`
```

---

## Design Decisions

### 1. Use JOIN with Watchers Table

**Decision:** Change query to JOIN with `Watchers` table.

**Rationale:**
- Matches the pattern used in `feedForWatcher`
- Correctly represents the relationship: photos are shared via the Watchers table
- The `friendUuid` parameter represents the user whose shared photos we want to see

### 2. Parameter Order

**Current signature:** `feedForFriend(uuid, friendUuid, pageNumber, batch, ...)`

**Analysis:** 
- `uuid`: current user (for authentication/authorization checks)
- `friendUuid`: the friend whose shared photos to show

**Decision:** Keep current parameter order. The fix only changes the query logic, not the signature.

### 3. Friendship Validation

**Current behavior:** Checks if accepted friendship exists between `uuid` and `friendUuid`

**Decision:** Keep this validation. It ensures users can only see photos of friends they have an accepted friendship with.

---

## Implementation Plan

### Step 1: Update SQL Query

**File:** `lambda-fns/controllers/friendships/feedForFriend.ts`

**Change:**
```diff
  const query = `
    SELECT p.*
    FROM "Photos" p
+   INNER JOIN "Watchers" w
+     ON p.id = w."photoId"
    WHERE
-     p."uuid" = $1
+     w.uuid = $1
    AND p.active = true
    ${searchClause}
    ORDER BY p.${sortField} ${direction}
    LIMIT $2
    OFFSET $3
  `
```

### Step 2: Update Parameter Binding

**Current:** `params: [friendUuid, limit, offset, ...searchParams]`

**Decision:** No change needed. The `friendUuid` is already the first parameter and will be used for `w.uuid = $1`.

### Step 3: Add Tests (Optional but Recommended)

Add unit tests to verify:
1. Returns photos where friend is a watcher
2. Returns empty array when friend has no shared photos
3. Returns empty array when no friendship exists

---

## Alternative Solutions Considered

### Alternative 1: Use Friendships Table Directly

**Idea:** Join Photos -> Friendships -> Photos to find shared photos.

**Why not:** This would be overly complex and doesn't match the existing data model. Photos are shared via the Watchers table, not the Friendships table.

### Alternative 2: Add a New "SharedPhotos" Table

**Idea:** Create a dedicated table for shared photos with columns: `sharedPhotoUuid`, `sharedWithUuid`, `photoId`.

**Why not:** This would require a database migration and change the existing architecture. The Watchers table already exists and serves this purpose.

### Alternative 3: Store SharedWith UUIDs in Photos

**Idea:** Add a `sharedWith` array field to Photos.

**Why not:** This would denormalize the data and make it harder to track who has access to each photo. The Watchers table is the correct normalized design.

---

## Risks and Mitigations

### Risk: Performance Impact

**Issue:** JOIN might be slower than direct filter.

**Mitigation:** 
- The `Watchers` table should have an index on `uuid` column
- The query still uses LIMIT/OFFSET for pagination
- Performance should be comparable to `feedForWatcher`

### Risk: Breaking Changes

**Issue:** Could affect existing queries that expect empty results.

**Mitigation:** 
- The current behavior is broken (always returns empty)
- Fix restores expected functionality
- No clients depend on the broken behavior

### Risk: Friendship Validation

**Issue:** Current query doesn't verify friendship exists.

**Mitigation:** 
- Already has friendship validation before the query
- Will continue to work after the fix

---

## Testing Checklist

- [ ] Run `feedForFriend` with valid friendship and photos - returns photos
- [ ] Run `feedForFriend` with valid friendship but no photos - returns empty array
- [ ] Run `feedForFriend` with invalid friendship - throws error
- [ ] Click photo in friend card - navigates to friend feed with photos
- [ ] Click friend card (not photo) - shows friend info screen
- [ ] Scroll friend feed - loads more photos
- [ ] Pull to refresh - resets and reloads photos
