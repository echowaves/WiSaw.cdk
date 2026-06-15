## Context

The WiSaw backend uses AWS AppSync (GraphQL) with DynamoDB for photo storage. The `Friendship` type currently lacks a `photosCount` field. Photos are stored in a DynamoDB table with wave associations. The `Wave` type already has a `photosCount` field computed via a DynamoDB query on a GSI (`gsi1pk`/`gsi1sk`).

**Current State:**
- `Friendship` type has: `id`, `friendUuid`, `friend`, `status`, `createdAt`
- `Wave` type has: `photosCount` computed via DynamoDB query
- Photos table has GSI `gsi1pk`/`gsi1sk` for wave-based queries

**Constraints:**
- Lambda resolver runs in Node.js/TypeScript
- DynamoDB queries should be efficient (avoid full table scans)
- Photo count should be computed at query time (not cached)

## Goals / Non-Goals

**Goals:**
- Add `photosCount: Int` field to `Friendship` type
- Compute photo count efficiently per friend in `getFriendshipsList` resolver
- Follow existing patterns used for `Wave.photosCount`

**Non-Goals:**
- Caching or pre-computing photo counts
- Real-time updates (frontend can use subscriptions later)
- Filtering or sorting by photo count

## Decisions

### Decision 1: Compute photo count at query time vs. store as denormalized field
**Choice:** Compute at query time.
**Rationale:** Photo counts are read-heavy but write-light. Denormalization adds complexity and consistency risks. The DynamoDB query cost for counting photos per friend is acceptable given typical friend list sizes (< 100 friends).

### Decision 2: How to associate photos with friends
**Choice:** Count photos in waves owned by the friend (where `ownerUuid` = friend's UUID).
**Rationale:** The Wave table has `ownerUuid` field, and photos have `waveUuid`. The resolver will:
1. For each friendship, identify waves owned by the friend
2. Query the Photos table using the GSI (`gsi1pk = waveUuid`, `gsi1sk = photoId`) to count photos per wave
3. Sum counts across all waves

**Alternative considered:** Add a `contributorUuid` GSI to the Photos table to directly query photos by user. This would be more efficient but requires schema change.

### Decision 3: Single query vs. per-friend queries
**Choice:** Batch approach — collect all friend UUIDs, query all their waves in one query, then count photos per wave in a batch query.
**Rationale:** Reduces DynamoDB API calls from O(n) to O(1) where n = number of friends. For 50 friends, this means ~2 queries instead of ~100 (50 for waves + 50 for photo counts).

## Risks / Trade-offs

[Risk] Performance degradation with large friend lists → [Mitigation] Add pagination or limit to friend list queries; photo count computation scales with friend count
[Risk] Stale counts if photos are deleted → [Mitigation] Counts are computed at query time, so they are always current
[Risk] DynamoDB read capacity consumption → [Mitigation] Use on-demand capacity mode; typical friend lists are small enough that cost is negligible