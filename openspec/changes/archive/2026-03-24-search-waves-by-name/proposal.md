## Why

The `listWaves` query currently returns all of a user's waves with pagination and sorting, but provides no way to filter by name or description. As users accumulate more waves, they need a way to quickly find a specific wave by typing part of its name or description.

## What Changes

- Add an optional `searchTerm` parameter to the `listWaves` GraphQL query.
- When provided, filter waves using case-insensitive substring matching (`ILIKE`) on both `name` and `description` fields.
- Add `name` as an allowed sort field so users can sort alphabetically when browsing search results.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `list-waves-sorting`: Adding `name` as an allowed sort field and adding `searchTerm` filter parameter to `listWaves`.

## Impact

- **GraphQL schema**: `listWaves` query gains a new optional `searchTerm: String` parameter.
- **Controller**: `lambda-fns/controllers/waves/listWaves.ts` — SQL query updated with conditional `ILIKE` clause; `name` added to sort whitelist.
- **Resolver dispatch**: `lambda-fns/index.ts` — pass `searchTerm` argument through to controller.
- **No migration needed** — `name` column already has a btree index (from `20251124000000-create-waves.js`).
