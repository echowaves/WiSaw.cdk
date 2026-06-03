## Why

The `updateWave` and `createWave` GraphQL mutations have type mismatches between the schema and the actual Lambda controllers. The schema declares `splashDate: String`, `freezeDate: String`, `freezeMode: String` and returns `Boolean!`, but the controllers return `Promise<Wave>` and the `Wave` type defines `splashDate: AWSDateTime!`, `freezeDate: AWSDateTime!`, `freezeMode: WaveFreezeMode!`. This causes the client to receive type errors and prevents the UI from correctly passing date/freeze-mode values.

## What Changes

- Add missing `splashDate: AWSDateTime` and `freezeDate: AWSDateTime` parameters to `createWave` mutation
- Change `splashDate: String` → `splashDate: AWSDateTime` in `updateWave` mutation
- Change `freezeDate: String` → `freezeDate: AWSDateTime` in `updateWave` mutation
- Change `freezeMode: String` → `freezeMode: WaveFreezeMode` in `updateWave` mutation
- Change return type `Boolean!` → `Wave!` for both `createWave` and `updateWave` mutations

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `waves`: The `createWave` and `updateWave` mutation requirements expand to use correct GraphQL types (`AWSDateTime` for dates, `WaveFreezeMode` enum for freeze mode, `Wave!` return type)

## Impact

- **GraphQL Schema**: `graphql/schema.graphql` — `createWave` and `updateWave` mutation signatures and return types
- **No handler/controller changes**: Lambda functions already return `Wave` objects and accept date strings
- **No migration changes**: Database columns are already correct types
