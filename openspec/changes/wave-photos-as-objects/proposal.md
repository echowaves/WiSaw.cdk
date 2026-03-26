## Why

The `listWaves` query currently returns wave thumbnail photos as an array of URL strings (`[String]`). The client needs richer photo metadata — dimensions, video flag, full/thumb/video URLs — to properly render wave thumbnails. Returning full `Photo` objects eliminates the need for separate fetches and aligns the wave list response with how photos are returned everywhere else in the API (e.g., `PhotoFeed`).

## What Changes

- **BREAKING**: `Wave.photos` field type changes from `[String]` to `[Photo]` in the GraphQL schema
- The `listWaves` controller's photo subquery expands from selecting only `id` to selecting all `Photos` columns
- Photo rows are transformed via `plainToClass(Photo, row).toJSON()` to produce `imgUrl`, `thumbUrl`, `videoUrl` computed fields
- The `Wave` TypeScript model updates `photos` from `string[]` to match the Photo shape

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `waves`: The `Wave` GraphQL type's `photos` field changes from `[String]` (thumbnail URLs) to `[Photo]` (full Photo objects with computed URL fields)

## Impact

- **GraphQL schema**: `Wave.photos` type changes — **breaking change** for clients reading this field as strings
- **Files modified**: `graphql/schema.graphql`, `lambda-fns/controllers/waves/listWaves.ts`, `lambda-fns/models/wave.ts`
- **No new dependencies**
- **No database migration** — uses existing `Photos` table columns
- **Client impact**: Mobile app must be updated to consume `Photo` objects instead of URL strings from `wave.photos`
