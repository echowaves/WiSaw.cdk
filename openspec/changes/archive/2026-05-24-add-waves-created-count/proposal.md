## Why

The `autoGroupPhotosIntoWaves` mutation returns an `AutoGroupResult` that tells clients how many photos were grouped and whether a new wave was created, but it doesn't report how many waves were actually created in the batch. Clients need this count to understand grouping activity — e.g., showing "3 waves created from 45 photos" in the UI.

## What Changes

- Add `wavesCreated: Int!` field to the `AutoGroupResult` GraphQL type
- Track a counter in `autoGroupPhotosIntoWaves.ts` that increments each time `createWave()` is called during batch processing
- Return the count in the final result object

## Capabilities

### New Capabilities
<!-- None — this modifies an existing capability -->

### Modified Capabilities
- `auto-group-waves`: The `AutoGroupResult` response now includes a `wavesCreated` field reporting how many new waves were created during auto-grouping.

## Impact

- **GraphQL schema**: `graphql/schema.graphql` — adds `wavesCreated: Int!` to `AutoGroupResult` type
- **Lambda controller**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — adds counter variable, increments on each wave creation, returns in result object
- **No database changes** — this is purely an API response addition
