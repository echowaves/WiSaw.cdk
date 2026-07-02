## Context

Four GraphQL queries currently accept `sortBy` and `sortDirection` parameters that the React Native client never passes. Each controller validates these against whitelist constants (`ALLOWED_SORT_FIELDS`, `ALLOWED_SORT_EXPRESSIONS`, `ALLOWED_DIRECTIONS`) and applies dynamic SQL ORDER BY clauses. Since the client never uses them, this is dead code adding complexity.

### Current State

```
listWaves(sortBy, sortDirection)  → createdAt, updatedAt, name + asc/desc
getFriendshipsList(sortBy, sortDirection) → recentPhoto + asc/desc
feedForWave(sortBy, sortDirection) → createdAt, updatedAt + asc/desc
feedForFriend(sortBy, sortDirection) → createdAt, updatedAt + asc/desc
```

## Goals / Non-Goals

**Goals:**
- Remove `sortBy` and `sortDirection` parameters from all four queries
- Hardcode a sensible default sort per query
- Eliminate sort validation and whitelist constants from the four controllers
- Simplify `lambda-fns/index.ts` handler arg mappings

**Non-Goals:**
- Client-side query changes (handled separately)
- Spec file updates (done at archive time)
- Adding new sort options

## Decisions

### Decision 1: Default sort per query

| Query | Default | Rationale |
|-------|---------|-----------|
| `listWaves` | `createdAt DESC` | Newest waves first — users expect chronological feed |
| `getFriendshipsList` | `createdAt DESC` | Newest friendships first — consistent with waves |
| `feedForWave` | `updatedAt DESC` | Most recently updated photos first — standard feed behavior |
| `feedForFriend` | `updatedAt DESC` | Same as `feedForWave` — consistent photo feed ordering |

### Decision 2: Remove, don't deprecate

The parameters are never used by the client. No deprecation period needed — just remove them. The client will be updated separately to stop passing these args.

### Decision 3: One change, four controllers

All four changes are small and mechanical (remove params, remove validation, hardcode ORDER BY). They can all be implemented in a single change without splitting.

## Risks / Trade-offs

- **[Schema breakage for client]** — Removing params from the schema while the client still sends them is harmless (AppSync ignores unknown args), but the client should be updated to avoid dead code. Client updates handled separately.
- **[Loss of sort flexibility]** — Users can no longer sort waves alphabetically or browse friends by recent photo activity. These features are unused and can be re-added later if needed.

## Migration Plan

1. Update GraphQL schema to remove params from all four queries
2. Update each controller to remove sort logic and hardcode ORDER BY
3. Update `lambda-fns/index.ts` to remove sort args from handler getArgs
4. Verify no compile errors (`npm run build`)
5. Update OpenSpec specs at archive time

## Open Questions

None.
