## Why

Full-text search on photo feeds indexes the entire raw AWS Rekognition JSON blob (`"metaData"::text`), including structural keys (`Name`, `Confidence`, `BoundingBox`, `Width`, `Height`, `Left`, `Top`), numeric values, and moderation labels. This causes irrelevant photos to appear in search results — searching for "left" or "top" matches nearly every photo because those are JSON keys in every Rekognition response.

## What Changes

- Add a `searchableText` TEXT column to the `Recognitions` table containing only the meaningful searchable content: label names (`Labels[*].Name`) and detected text (`TextDetections[*].DetectedText`)
- Backfill `searchableText` for all existing Recognitions rows from their `metaData` JSONB
- Create a GIN index on `to_tsvector('English', "searchableText")` and drop the old GIN index on `to_tsvector('English', "metaData"::text)`
- Update `processUploadedImage` to populate `searchableText` when inserting new Recognition records
- Update `buildSearchClause` to query `searchableText` instead of `"metaData"::text`

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `photo-feed`: The shared search clause utility changes its Recognitions query from `to_tsvector('English', "metaData"::text)` to `to_tsvector('English', "searchableText")`, narrowing search to label names and detected text only.

## Impact

- **Database**: New column + backfill migration + GIN index swap on `Recognitions` table
- **Lambda `processUploadedImage`**: Populate `searchableText` on Recognition insert
- **Utility `searchClause.ts`**: One-line change to query the new column
- **All feed controllers**: Benefit from improved search precision with no code changes (they use `buildSearchClause`)
- **GraphQL API**: No schema changes — `Recognition.metaData` remains unchanged for clients
