## Why

The `autoGroupPhotosIntoWaves` mutation times out for users with many ungrouped photos. It currently clusters ALL ungrouped photos, geocodes every cluster centroid (with a 1-second delay per Nominatim call), and creates all waves in a single Lambda invocation. For users with hundreds of photos spanning many locations/time periods, this easily exceeds the Lambda/AppSync timeout.

## What Changes

- **BREAKING**: Change `autoGroupPhotosIntoWaves` to create only **one wave per invocation**, processing the oldest temporal cluster first
- Add `photosRemaining` and `hasMore` fields to `AutoGroupResult` so the client knows whether to call again
- The client calls the mutation repeatedly until `hasMore` is `false`

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `auto-group-photos`: Change from processing all clusters at once to processing one cluster per invocation (oldest first), returning remaining photo count and continuation flag

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — Major refactor: process one cluster, return early
- `graphql/schema.graphql` — Add `photosRemaining: Int!` and `hasMore: Boolean!` to `AutoGroupResult`
- Client apps must loop calls until `hasMore` is `false` (**BREAKING** for clients that expect a single call)
