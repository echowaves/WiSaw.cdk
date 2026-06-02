## Why

The `updateWave` GraphQL mutation in `graphql/schema.graphql` is missing `open`, `splashDate`, `freezeDate`, and `freezeMode` parameters. The lambda handler and controller both expect these parameters, but the schema rejects them at the GraphQL layer, causing the UI to error when trying to modify a wave's freeze date.

## What Changes

- Add missing parameters (`open`, `splashDate`, `freezeDate`, `freezeMode`) to the `updateWave` mutation in `graphql/schema.graphql`
- No behavior changes — the handler and controller already support these parameters correctly

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `waves`: The `updateWave` mutation requirement expands to include `open`, `splashDate`, `freezeDate`, and `freezeMode` parameters

## Impact

- **GraphQL Schema**: `graphql/schema.graphql` — `updateWave` mutation signature
- **No other files affected** — handler (`lambda-fns/index.ts`) and controller (`lambda-fns/controllers/waves/update.ts`) already wire these parameters correctly
