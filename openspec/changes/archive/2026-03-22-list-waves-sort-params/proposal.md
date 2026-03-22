## Why

The `listWaves` query currently hardcodes sorting to `updatedAt DESC`. Users need the ability to sort their wave list by different criteria — e.g. seeing oldest waves first (`createdAt ASC`) or most recently created (`createdAt DESC`). Adding optional sort parameters with backward-compatible defaults enables this without breaking existing clients.

## What Changes

- Add two optional parameters to the `listWaves` GraphQL query: `sortBy` (defaults to `"updatedAt"`) and `sortDirection` (defaults to `"desc"`)
- Update the `listWaves` controller to accept these parameters and build the ORDER BY clause from a whitelist of allowed values (preventing SQL injection)
- Wire the new parameters through the resolver in `index.ts`

## Capabilities

### New Capabilities
- `list-waves-sorting`: Optional sort parameters for the listWaves query with whitelist-based SQL injection prevention

### Modified Capabilities

## Impact

- **GraphQL schema**: `listWaves` query gains two optional `String` parameters
- **Lambda code**: `listWaves.ts` controller updated to accept and validate sort params; `index.ts` resolver wiring updated
- **Backward compatible**: Both parameters are optional with defaults matching current behavior (`updatedAt DESC`)
- **No database changes**: No migrations needed
