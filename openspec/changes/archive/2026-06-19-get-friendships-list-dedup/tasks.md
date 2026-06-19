# Tasks: Fix getFriendshipsList Duplicate Photos Bug

## Implementation Tasks

### Task 1.1: Update friendship query with DISTINCT ON

**File:** `lambda-fns/controllers/friendships/getFriendshipsList.ts`

**Description:** Modify the friendship query to deduplicate bidirectional friendships, keeping the most recent entry.

**Changes:**
- Add `DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2))` to the SELECT clause
- Add `ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC` to keep most recent

**Changes Applied:**
```typescript
SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *
    FROM "Friendships"
    WHERE "uuid1" = $1
    OR "uuid2" = $1
    ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC
```

**Acceptance:**
- [x] Query returns unique friendship pairs only
- [x] Most recent entry is preserved for duplicates
- [x] No duplicate entries in result

### Task 1.2: Verify existing tests still pass

**File:** `tests/`

**Description:** Run existing tests to ensure no regression.

**Acceptance:**
- [ ] All existing tests pass
- [ ] No breaking changes introduced

## Testing Tasks

### Task 2.1: Test bidirectional friendship deduplication

**Setup:**
```sql
INSERT INTO "Friendships" ("friendshipUuid", "uuid1", "uuid2", "createdAt")
VALUES 
  ('uuid-1', 'user-A', 'user-B', '2026-01-01T00:00:00Z'),
  ('uuid-2', 'user-B', 'user-A', '2026-01-02T00:00:00Z');
```

**Steps:**
1. Query `getFriendshipsList(uuid='user-A')`
2. Verify exactly 1 friendship entry for 'user-B'
3. Verify the entry uses `createdAt='2026-01-02T00:00:00Z'` (most recent)
4. Verify photos are 'user-B's photos

**Acceptance:**
- [ ] Single entry returned for duplicate friendship
- [ ] Most recent createdAt is preserved
- [ ] Photos belong to correct friend

### Task 2.2: Test single-direction friendship

**Setup:**
```sql
INSERT INTO "Friendships" ("friendshipUuid", "uuid1", "uuid2", "createdAt")
VALUES ('uuid-3', 'user-A', 'user-B', '2026-01-01T00:00:00Z');
```

**Steps:**
1. Query `getFriendshipsList(uuid='user-A')`
2. Verify 1 entry for 'user-B'
3. Verify photos are 'user-B's photos

**Acceptance:**
- [ ] Single entry returned
- [ ] Photos belong to correct friend

### Task 2.3: Test pending friendship handling

**Setup:**
```sql
INSERT INTO "Friendships" ("friendshipUuid", "uuid1", "uuid2", "createdAt")
VALUES ('uuid-4', 'user-A', NULL, '2026-01-01T00:00:00Z');
```

**Steps:**
1. Query `getFriendshipsList(uuid='user-A')`
2. Verify pending friendship is NOT in results

**Acceptance:**
- [ ] Pending friendships (uuid2 = NULL) are excluded

### Task 2.4: Test self-friendship handling

**Setup:**
```sql
INSERT INTO "Friendships" ("friendshipUuid", "uuid1", "uuid2", "createdAt")
VALUES ('uuid-5', 'user-A', 'user-A', '2026-01-01T00:00:00Z');
```

**Steps:**
1. Query `getFriendshipsList(uuid='user-A')`
2. Verify self-friendship is NOT in results

**Acceptance:**
- [ ] Self-friendships are excluded

### Task 2.5: Test photos query correctness

**Setup:**
```sql
-- User A has photos with uuid='user-A'
INSERT INTO "Photos" ("id", "uuid", "active") VALUES ('photo-1', 'user-A', true);
-- User B has photos with uuid='user-B'
INSERT INTO "Photos" ("id", "uuid", "active") VALUES ('photo-2', 'user-B', true);
```

**Steps:**
1. Query `getFriendshipsList(uuid='user-A')` where user-A's friend is user-B
2. Verify only user-B's photos are returned (photo-2)
3. Verify user-A's photos are NOT returned (photo-1)

**Acceptance:**
- [ ] Only friend's photos are returned
- [ ] User's own photos are NOT returned

## Verification Tasks

### Task 3.1: Verify no duplicate entries

**Setup:** Create test data with bidirectional friendships

**Steps:**
1. Query `getFriendshipsList` for multiple users
2. Check response for duplicate friendship entries

**Acceptance:**
- [ ] No duplicate entries for same friend
- [ ] Each friend appears exactly once

### Task 3.2: Verify performance

**Setup:** Large dataset with 100+ friendships

**Steps:**
1. Query `getFriendshipsList`
2. Measure response time

**Acceptance:**
- [ ] Response time < 500ms
- [ ] No N+1 query issues

### Task 3.3: Verify data integrity

**Setup:** Database with existing duplicate friendships

**Steps:**
1. Query `getFriendshipsList` for various users
2. Verify results match expected behavior

**Acceptance:**
- [ ] Duplicate friendships are correctly deduplicated
- [ ] Most recent entry is preserved

## Rollback Plan

If issues are discovered:

1. Revert commit with the change
2. The old query will return duplicate entries, which is acceptable for now
3. No data loss expected

## Summary

**Total Tasks:** 20
**Implementation:** 2 tasks
**Testing:** 5 tasks  
**Verification:** 3 tasks
