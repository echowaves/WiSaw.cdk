## Why

The current `mergeWaves` mutation only supports merging one source wave into one target wave. Users who need to consolidate three or more waves into one must call the mutation repeatedly, which is cumbersome and increases the risk of partial state if the Lambda crashes mid-merge. Additionally, frozen waves owned by the user cannot be merged — the freeze state blocks the operation even though the owner should have full control over their own waves.

## What Changes

- **GraphQL schema**: Change `sourceWaveUuid: String!` → `sourceWaveUuids: [String!]!` to accept an array of source wave UUIDs
- **Controller** (`lambda-fns/controllers/waves/mergeWaves.ts`): Accept array, loop over each source wave, merge photos/users/delete each source sequentially, then recalculate photosCount once
- **Authorization**: Remove any freeze-state blocking — owners can merge their own waves regardless of freeze state
- **Wave naming**: Target wave name is preserved unless overridden via optional `name` param (no auto-recomputation)
- **Spec** (`openspec/specs/wave-merge/spec.md`): Updated to reflect N-wave merge capability and frozen wave handling

## Capabilities

### Modified Capabilities

- `wave-merge`: Extended from 2-wave merge to N-wave merge with frozen wave support
