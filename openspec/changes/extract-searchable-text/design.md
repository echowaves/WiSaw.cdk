## Context

Full-text search on Recognitions currently uses `to_tsvector('English', "metaData"::text)`, which indexes the entire raw AWS Rekognition JSON including structural keys, confidence scores, bounding box fields, and moderation labels. This produces false-positive search matches.

The `metaData` JSONB structure is:
```json
{
  "Labels": [{ "Name": "Person", "Confidence": 99.5, "Instances": [...] }],
  "ModerationLabels": [{ "Name": "Suggestive", "Confidence": 45.2, ... }],
  "TextDetections": [{ "DetectedText": "HELLO", "Type": "LINE", ... }]
}
```

Only `Labels[*].Name` and `TextDetections[*].DetectedText` are meaningful for user search.

## Goals / Non-Goals

**Goals:**
- Narrow full-text search on Recognitions to only label names and detected text
- Maintain GIN index performance for FTS queries
- Keep existing `metaData` column and GraphQL API unchanged

**Non-Goals:**
- Changing the Comments search (already indexes only `"comment"::text`, which is clean)
- Changing what Rekognition APIs are called or what's stored in `metaData`
- Adding search on moderation labels (intentionally excluded)

## Decisions

### Add a `searchableText` TEXT column populated explicitly in application code

**Decision**: Add a `searchableText` TEXT column to Recognitions. Populate it in `processUploadedImage` at insert time. The column contains a space-separated concatenation of `Labels[*].Name` and `TextDetections[*].DetectedText`.

**Rationale**: Explicit is better — the search content is visible, indexable with a simple GIN expression, and doesn't require database triggers or generated columns. The extraction logic lives in the application where it can be easily tested and modified.

**Alternatives considered**:
- PostgreSQL generated column: Can't use set-returning functions (`jsonb_array_elements`) in generated column expressions. Rejected.
- Database trigger: Hides logic in the database. Rejected per user preference.
- Inline JSON extraction in the query (Option A): Can't be GIN-indexed because `jsonb_array_elements` is set-returning. Rejected — performance regression.

### Extraction logic: Labels + TextDetections only

**Decision**: Extract `Labels[*].Name` and `TextDetections[*].DetectedText`. Exclude `ModerationLabels`, confidence scores, bounding boxes, and all JSON structural keys.

**Rationale**: Labels are the primary object/scene descriptors. TextDetections capture OCR text from images. ModerationLabels are content safety classifications that shouldn't be user-searchable.

### Three migrations: schema, backfill, index swap

**Decision**: Split into three sequential migrations following the project's separation-of-concerns convention.

**Rationale**: Schema changes, data transformations, and index operations are separate concerns. The backfill must complete before the index can be created. The old index should only be dropped after the new one is in place.

## Risks / Trade-offs

- **Backfill duration**: Large Recognitions table means the UPDATE may take time. Mitigation: process in batches with progress logging, per migration conventions.
- **Column denormalization**: `searchableText` duplicates information from `metaData`. Acceptable tradeoff — the column is small (label names + OCR text) and the alternative (runtime extraction) can't be indexed.
- **New photos during migration window**: Photos uploaded after migration 1 but before code deploy won't have `searchableText` populated. Mitigation: the backfill migration (2) fills all rows with NULL `searchableText`. The code deploy and migration can be coordinated, or a re-run of the backfill handles stragglers.
