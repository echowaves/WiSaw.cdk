## Context

The `listWaves` API returns paginated wave metadata via a SQL query joining `Waves` and `WaveUsers`. Photo data lives in the `Photos` table, linked to waves through `WavePhotos` (columns: `waveUuid`, `photoId`). Photo thumbnail URLs are derived from photo IDs: `https://${S3_IMAGES}/${id}-thumb.webp`.

Currently, clients must make separate API calls per wave to see its photos. This is inefficient for displaying wave lists with visual previews.

## Goals / Non-Goals

**Goals:**
- Return photo thumbnail URLs alongside each wave in `listWaves`
- Batch-fetch all photos for a page of waves in a single query (avoid N+1)

**Non-Goals:**
- Pagination of photos within a wave (full photo browsing uses existing `feedRecent`/`feedByDate`)
- Returning full photo metadata (dimensions, video flag, etc.) — only thumbnail URLs
- Changes to other wave APIs (create, update, delete, addPhoto, removePhoto)

## Decisions

**1. Return thumbnail URLs as `[String]` rather than structured photo objects**
- Rationale: The client only needs URLs for wave list previews. A `[String]` type is simpler and avoids a new GraphQL type. If richer photo data is needed later, the type can be changed.
- Alternative: A `[WavePhoto]` type with `thumbUrl`, `imgUrl`, `videoUrl` — rejected as over-engineering for the list view.

**2. Batch-fetch photos with a single query using `ANY($1)` on wave UUIDs**
- Rationale: Fetches all photos for all waves on the page in one query. Avoids N+1 per-wave queries.
- Alternative: Subquery in the main waves query — rejected because it complicates the existing query and makes the two concerns harder to maintain independently.

**3. Fetch all photos per wave (no limit)**
- Rationale: Waves are auto-grouped with a cap of 1000 photos. The client can truncate as needed. Adding a server-side limit would require choosing an arbitrary number.

## Risks / Trade-offs

- [Large photo lists] → Waves with many photos will produce larger payloads. Mitigated by returning only thumbnail URL strings (small per item) and the existing 1000-photo-per-wave cap.
- [Additional SQL query per request] → Adds one extra query per `listWaves` call. Mitigated by batch approach (single query for all waves on the page).
