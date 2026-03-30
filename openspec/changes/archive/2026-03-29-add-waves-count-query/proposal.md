## Why

The mobile app needs a lightweight way to display a badge/counter showing how many waves a user belongs to. Currently the only way to get this number is to paginate through `listWaves`, which fetches full wave objects with photos — wasteful for a simple count.

## What Changes

- Add a `getWavesCount(uuid: String!): Int!` GraphQL query
- Add a new controller `lambda-fns/controllers/waves/getWavesCount.ts` that counts `WaveUsers` rows for the given device UUID
- Add dispatcher entry in `lambda-fns/index.ts`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `waves`: Adding a count query for waves belonging to a user

## Impact

- **Code**: New controller file, GraphQL schema addition, dispatcher update
- **APIs**: New `getWavesCount` query — additive, no breaking changes
- **Risk**: None — read-only query on existing `WaveUsers` table
