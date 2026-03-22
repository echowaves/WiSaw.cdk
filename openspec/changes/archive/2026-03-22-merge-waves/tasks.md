## 1. GraphQL Schema

- [x] 1.1 Add `mergeWaves` mutation to `graphql/schema.graphql` with args: `targetWaveUuid: String!`, `sourceWaveUuid: String!`, `uuid: String!`, `name: String`, `description: String`, returning `Wave!`

## 2. Core Implementation

- [x] 2.1 Create `lambda-fns/controllers/waves/mergeWaves.ts` controller with input validation (UUID format, source ≠ target), authorization (createdBy on both waves), photo move, WaveUsers merge, optional name/description update, source wave deletion, and photosCount recalculation
- [x] 2.2 Wire up the `mergeWaves` resolver and import in `lambda-fns/index.ts`
