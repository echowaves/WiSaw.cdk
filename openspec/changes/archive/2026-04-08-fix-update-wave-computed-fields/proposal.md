## Why

The `updateWave` mutation returns a `Wave` object but does not populate the computed fields `isFrozen`, `myRole`, or `joinUrl`. Since `isFrozen` is `Boolean!` (non-nullable) in the GraphQL schema, the missing value causes a runtime GraphQL error, breaking the mutation response entirely. The other two fields silently return `null` instead of their expected values.

## What Changes

- Compute `isFrozen` from the updated row's `splashDate`/`freezeDate` before returning from `update.ts`
- Set `myRole` to `'owner'` (the role is already asserted at the top of the function)
- Compute `joinUrl` from the updated row's `open` flag and `DEEP_LINK_BASE_URL`, matching `getWave.ts` behavior

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `waves`: The "Update a Wave" requirement needs to specify that the returned Wave object SHALL include computed fields (`isFrozen`, `myRole`, `joinUrl`), consistent with `getWave`

## Impact

- `lambda-fns/controllers/waves/update.ts` — add computed field population after `plainToClass`
- `graphql/schema.graphql` — no changes (schema already declares these fields on the `Wave` type)
