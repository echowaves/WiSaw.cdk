## 1. Update GraphQL schema

- [x] 1.1 Add `waveUuid: String` and `name: String` (nullable) to `AutoGroupResult` type in `graphql/schema.graphql`

## 2. Update controller

- [x] 2.1 Add `waveUuid` and `name` fields to the `AutoGroupResult` TypeScript interface in `autoGroupPhotosIntoWaves.ts`
- [x] 2.2 Include `waveUuid` and `name` in the wave-created return value
- [x] 2.3 Include `waveUuid: null` and `name: null` in the zero-photos early return

## 3. Verify

- [x] 3.1 Run TypeScript compilation to confirm no errors
