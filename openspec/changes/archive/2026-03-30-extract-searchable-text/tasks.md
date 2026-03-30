## 1. Database Migrations

- [x] 1.1 Create migration `migrations/20260330140000-add-recognitions-searchable-text.js` — add nullable `searchableText` TEXT column to `Recognitions`
- [x] 1.2 Create migration `migrations/20260330140001-populate-recognitions-searchable-text.js` — backfill `searchableText` from `metaData` JSONB for all existing rows (extract `Labels[*].Name` and `TextDetections[*].DetectedText`)
- [x] 1.3 Create migration `migrations/20260330140002-swap-recognitions-fts-gin-index.js` — create GIN index on `to_tsvector('English', "searchableText")` and drop old GIN index on `to_tsvector('English', "metaData"::text)`

## 2. Application Code

- [x] 2.1 Update `processUploadedImage/index.ts` to extract `searchableText` from the `metaData` object and include it in the INSERT statement
- [x] 2.2 Update `searchClause.ts` to query `to_tsvector('English', "searchableText")` instead of `to_tsvector('English', "metaData"::text)`

## 3. Verification

- [x] 3.1 Compile TypeScript and verify no errors
