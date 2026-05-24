## 1. GraphQL Schema Update

- [x] 1.1 Add `wavesCreated: Int!` field to `AutoGroupResult` type in `graphql/schema.graphql` (line ~185)

## 2. TypeScript Interface & Counter

- [x] 2.1 Add `wavesCreated: number` to the `AutoGroupResult` interface in `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`
- [x] 2.2 Declare `let wavesCreated = 0` alongside other counter variables (near line ~284)

## 3. Wave Creation Counter Increment

- [x] 3.1 Increment `wavesCreated++` each time `createWave()` is called — in the "no active wave / grouping level changed" block at line ~342
- [x] 3.2 Verify no other code path creates waves that should be counted (the break-path at line ~456 does NOT create a new wave, it just clears `activeWave`)

## 4. Return the Count

- [x] 4.1 Add `wavesCreated` to the final return object in `autoGroupPhotosIntoWaves.ts` (line ~522)
- [x] 4.2 Ensure early-return path (no photos, line ~275) also returns `wavesCreated: 0`
