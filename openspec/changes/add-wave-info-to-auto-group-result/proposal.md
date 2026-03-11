## Why

The client queries `waveUuid` and `name` from the `autoGroupPhotosIntoWaves` mutation response so it can immediately display the newly created wave. The current `AutoGroupResult` type lacks these fields, causing a GraphQL validation error: `Field 'waveUuid' in type 'AutoGroupResult' is undefined`.

## What Changes

- Add `waveUuid: String` and `name: String` fields to the `AutoGroupResult` GraphQL type (nullable, since the zero-photos path creates no wave)
- Return the created wave's UUID and name from the controller

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auto-group-photos`: `AutoGroupResult` must include `waveUuid` and `name` of the created wave (null when no wave is created)

## Impact

- `graphql/schema.graphql` — `AutoGroupResult` type gains two fields
- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — interface and return values updated
