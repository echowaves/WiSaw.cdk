## Context

The `listWaves` controller currently runs two queries: one for waves, one for the top-5 most recent photos per wave. The photo query only selects `"waveUuid"` and `"id"`, then manually constructs thumbnail URL strings. The results are stored in `wave.photos` as `string[]`.

The existing `Photo` model class has a `toJSON()` method that computes `imgUrl`, `thumbUrl`, and `videoUrl` from the photo's `id` and the `S3_IMAGES` environment variable. All other photo-returning endpoints (feeds, photo detail) use this pattern via `plainToClass(Photo, row)`.

## Goals / Non-Goals

**Goals:**
- Return full `Photo` objects (with computed URLs, dimensions, video flag) from `Wave.photos`
- Reuse the existing `Photo` model and its `toJSON()` method — same pattern as all photo feeds
- Keep the top-5-most-recent photo selection logic unchanged

**Non-Goals:**
- Changing the number of photos returned per wave (stays at 5)
- Adding pagination for wave photos (that's what `feedForWave` is for)
- Changing how other wave endpoints work

## Decisions

### Decision 1: Reuse the existing `Photo` type rather than creating a new `WavePhoto` type

**Choice**: Use the existing `Photo` GraphQL type for `Wave.photos`.

**Alternative**: Create a slimmer `WavePhoto` type with only `id`, `thumbUrl`, `width`, `height`, `video`.

**Rationale**: The client already knows how to render `Photo` objects from feeds. Reusing the same type avoids duplication and ensures consistency. The payload increase (~15 fields vs 1 URL string, for 5 photos per wave) is negligible.

### Decision 2: Use `row_num` from the existing window function as `row_number`

**Choice**: Alias the existing `ROW_NUMBER() OVER (PARTITION BY ...)` result as `row_number` in the SQL output.

**Rationale**: The `Photo` GraphQL type requires `row_number: Int!`. The existing partition window function already numbers photos 1–5 within each wave. Reusing this as the `row_number` field satisfies the schema requirement without an additional window function.

### Decision 3: Expand the photo subquery to `SELECT "Photos".*`

**Choice**: Select all columns from `Photos` instead of only `"id"`.

**Rationale**: The `Photo.toJSON()` method needs `id` (for URL construction), and the GraphQL type exposes `uuid`, `location`, `commentsCount`, `watchersCount`, `createdAt`, `updatedAt`, `active`, `video`, `width`, `height`, `lastComment`. All of these are columns on the `Photos` table, so `SELECT "Photos".*` covers them all.

## Risks / Trade-offs

- **[Breaking change]** → Clients reading `wave.photos` as strings will break. **Mitigation**: Coordinate with mobile app release; the client must request Photo sub-fields in the GraphQL query.
- **[Slightly larger response payload]** → Each photo goes from ~60 bytes (URL string) to ~300 bytes (Photo object). For 20 waves × 5 photos = 100 photos, that's ~30KB vs ~6KB. **Mitigation**: Still well within reasonable API response sizes.
- **[row_number semantics differ from feeds]** → In feeds, `row_number` is a global position across the paginated list. Here it's 1–5 within each wave. **Mitigation**: Acceptable since the wave photo list is not paginated — it's always the top 5.
