# Proposal: Fix getFriendshipsList Duplicate Photos Bug

## Why

The `getFriendshipsList` GraphQL query has a bug where viewing a friend's feed shows photos from the query user (self) in addition to the friend's photos. This happens because:

1. Friendships are stored bidirectionally: both `(uuid1=A, uuid2=B)` and `(uuid1=B, uuid2=A)` can exist
2. When A queries `getFriendshipsList`, both friendships are found
3. Both extract friend UUID as B, but the photos query returns photos for B
4. When B queries `getFriendshipsList`, the same happens - photos for A are returned
5. Result: Users see each other's photos mixed together

**Evidence:**
- User's device UUID: `a8697b17-7b63-41ac-a65c-481793fbccb6` (foobuz)
- User has 7 friendships, all confirmed (uuid2 != null)
- Photos table uses `uuid` column for device UUID = owner UUID
- Friendships table has both directions: `(A,B)` and `(B,A)`

## What Changes

Add deduplication logic to `getFriendshipsList` to ensure each unique friendship pair returns only one entry with the correct friend's photos.

## Capabilities

- `getFriendshipsList(uuid: string)`: Returns list of friendships with friend previews

### Modified Behavior

**Before:** Both `(A,B)` and `(B,A)` return entries, with photos for B and A respectively
**After:** Only one entry per friendship pair, with photos for the correct friend

## Impact

**Affected Files:**
- `lambda-fns/controllers/friendships/getFriendshipsList.ts`

**Behavior Changes:**
- Deduplicate friendships at read time
- Keep the friendship with the most recent `createdAt` for duplicates
- Return unique friendships only

## Context

The photos query currently uses:
```sql
WHERE "Photos"."uuid" = ANY($1)  -- $1 = friendUuids
```

Where `Photos.uuid` is the photo owner's UUID.

## Goals / Non-Goals

**Goals:**
- Fix duplicate photos appearing in friend feeds
- Preserve existing functionality for single-direction friendships
- Maintain performance with minimal query changes

**Non-Goals:**
- Not changing friendship creation logic
- Not changing data model
- Not affecting pending friendships (uuid2 = null)

## Decisions

**Design:** Deduplicate friendships by normalized pair `(LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2))` at query time.

**Rationale:**
- Minimal code changes
- No database migrations required
- Preserves existing data integrity
- Handles both directions correctly

## Risks / Trade-offs

**Risk:** Users with multiple friendship requests (same pair) might see only the most recent one.

**Mitigation:** This is acceptable behavior - friendship should be unique per pair. Any duplicate entries are data anomalies that should be cleaned up.

## Tasks

- [ ] **Implementation**
  - [ ] Add deduplication to friendship query in `getFriendshipsList.ts`
  - [ ] Test with existing friendships
  - [ ] Test with new friendships
  
- [ ] **Testing**
  - [ ] Test both directions: `(A,B)` and `(B,A)` return single entry
  - [ ] Test most recent preserved when duplicates exist
  - [ ] Test single-direction friendships still work
  - [ ] Test pending friendships (uuid2 = null) handled correctly
  - [ ] Test photos returned for correct friend

- [ ] **Verification**
  - [ ] Query `getFriendshipsList` for user with bidirectional friendships
  - [ ] Verify no duplicate entries in response
  - [ ] Verify photos belong to correct friend
  - [ ] Verify performance is acceptable
