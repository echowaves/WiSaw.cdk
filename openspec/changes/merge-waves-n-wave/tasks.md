## 1. GraphQL Schema

- [x] 1.1 Change `sourceWaveUuid: String!` → `sourceWaveUuids: [String!]!` in `graphql/schema.graphql` `mergeWaves` mutation

## 2. Controller Implementation

- [x] 2.1 Update `lambda-fns/controllers/waves/mergeWaves.ts` signature: `sourceWaveUuid: string` → `sourceWaveUuids: string[]`
- [x] 2.2 Add upfront validation: empty array check, self-merge check per source, duplicate source UUID check
- [x] 2.3 Change authorization: `_assertWaveRole` on target + loop over all sources
- [x] 2.4 Extract merge loop: photos move, WaveUsers merge (ON CONFLICT DO NOTHING), source users deleted, source wave deleted — per source
- [x] 2.5 Move name/description metadata UPDATE after the merge loop (single update, not per-source)
- [x] 2.6 Remove any freeze-state checks (owners can merge regardless of freeze)
- [x] 2.7 Single `_updatePhotosCount` call after all sources merged

## 3. Handler Wiring

- [x] 3.1 Update `lambda-fns/index.ts` `getArgs` for `mergeWaves`: `args.sourceWaveUuid` → `args.sourceWaveUuids`
- [x] 3.2 Update `lambda-fns/index.ts` `AppSyncEvent.arguments` type: `sourceWaveUuid: string` → `sourceWaveUuids: string[]`

## 4. Spec Documentation

- [x] 4.1 Update `openspec/specs/wave-merge/spec.md` requirement: "Merge two waves" → "Merge multiple waves into one"
- [x] 4.2 Add scenario: successful merge of three or more waves
- [x] 4.3 Add scenario: merge preserves target wave name
- [x] 4.4 Add scenario: optional name override
- [x] 4.5 Add scenario: owner merges frozen waves
- [x] 4.6 Update authorization requirement to cover all source waves
- [x] 4.7 Add input validation scenarios: empty source list, duplicate source UUIDs
- [x] 4.8 Update all existing scenarios to reference `sourceWaveUuids` instead of `sourceWaveUuid`
