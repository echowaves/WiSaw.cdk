## Context

The friendship system stores relationships in the `Friendships` table:
- `uuid1`: First user in the friendship
- `uuid2`: Second user (NULL until friendship is accepted)

A self-friendship occurs when `uuid1 = uuid2`, which can happen through:
1. `createFriendship(uuid)` creates `uuid1=uuid, uuid2=NULL`
2. `acceptFriendshipRequest(friendshipUuid, uuid)` sets `uuid2=uuid`, creating `uuid1=uuid, uuid2=uuid`

The `getFriendshipsList(uuid)` function extracts friend UUIDs and includes self-friendships in the result.

## Goals / Non-Goals

**Goals:**
- Prevent self-friendships from being created at the application level
- Filter out any existing self-friendships from query results
- Maintain backward compatibility for valid friendships

**Non-Goals:**
- Database-level constraints (PostgreSQL CHECK constraint) - application-level prevention is sufficient
- Migrating existing self-friendships - they'll be filtered from future queries
- Changing the friendship data model

## Decisions

### Decision 1: Two-Layer Defense

**Choice:** Prevent at creation + filter at read time

**Rationale:**
- Preventing at creation (`createFriendship`, `acceptFriendshipRequest`) stops new self-friendships
- Filtering at read time (`getFriendshipsList`, `feedForFriend`) is a safety net for any existing self-friendships
- If the application logic has bugs, the read-time filter catches them

### Decision 2: Validation vs Filtering Separation

**Choice:** 
- `createFriendship` and `acceptFriendshipRequest` reject self-friendships with errors
- `getFriendshipsList` filters self-friendships silently
- `feedForFriend` rejects self-friendships with errors

**Rationale:**
- Creation errors inform users they're making a mistake
- Read-time filtering is transparent to users (they don't expect to see themselves anyway)
- `feedForFriend` rejects because it's a direct query - if user passes self as friendUuid, it's clearly a bug

### Decision 3: No Database Constraints

**Choice:** Application-level validation only, no PostgreSQL CHECK constraint

**Rationale:**
- The bug only occurs through the application layer
- Database constraints would require a migration to handle existing data
- Application-level checks are sufficient for this use case

## Risks / Trade-offs

**Risk:** Existing self-friendships in database will be silently filtered
→ **Mitigation:** This is desired behavior - users shouldn't see themselves in friend lists. If needed, we can add a migration later to clean up self-friendships.

**Risk:** Users may be confused if `feedForFriend` rejects self as friend
→ **Mitigation:** This is clearly a bug in the calling code. The error message should clarify: "Cannot fetch feed for self - friendUuid cannot be the same as uuid"

**Risk:** Self-friendship prevention in `acceptFriendshipRequest` may block legitimate acceptances
→ **Mitigation:** The check `existing[0].uuid1 === uuid` only blocks if the friendship was created by the same user. Legitimate friendships have different `uuid1` and `uuid2`.
