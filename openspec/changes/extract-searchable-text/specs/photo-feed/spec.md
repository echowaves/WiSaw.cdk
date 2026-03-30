## MODIFIED Requirements

### Requirement: Shared search clause utility
The system SHALL provide a reusable `buildSearchClause(searchTerm, paramStartIndex)` utility that returns a SQL WHERE clause fragment and corresponding parameter array for full-text search filtering on Recognitions searchable text and Comments text. The clause SHALL use a table-qualified column reference (`p."id"`) so it works in queries with JOINs. The Recognitions subquery SHALL use `to_tsvector('English', "searchableText")` to search only extracted label names and detected text, excluding JSON structural keys, confidence scores, bounding boxes, and moderation labels.

#### Scenario: Search term provided
- **WHEN** `buildSearchClause` is called with a non-null search term and a param start index
- **THEN** it returns a clause `AND p."id" IN (SELECT ... UNION ...)` using the given param index, and a params array containing the search term

#### Scenario: Search term is null
- **WHEN** `buildSearchClause` is called with null or undefined
- **THEN** it returns an empty clause string and an empty params array

#### Scenario: Search clause used in JOINed query
- **WHEN** the returned clause is used in a query that JOINs Photos with another table (e.g., Watchers, WavePhotos)
- **THEN** the column reference SHALL NOT be ambiguous — it SHALL resolve to the Photos table

#### Scenario: Search matches label names only
- **WHEN** a user searches for a term that appears as a Rekognition label name (e.g., "Person", "Car")
- **THEN** photos with that label SHALL be included in results

#### Scenario: Search matches detected text only
- **WHEN** a user searches for text that was detected in an image via OCR
- **THEN** photos containing that detected text SHALL be included in results

#### Scenario: Search does not match JSON structural keys
- **WHEN** a user searches for terms that only appear as JSON keys in the raw metaData (e.g., "Confidence", "BoundingBox", "Width")
- **THEN** no photos SHALL match based on those structural terms alone

---

### Requirement: GIN index on Recognitions.metaData
The database SHALL have a GIN index on `to_tsvector('English', "searchableText")` on the `Recognitions` table. This index SHALL be used by the full-text search subquery in `buildSearchClause`. The previous GIN index on `to_tsvector('English', "metaData"::text)` SHALL be removed.

#### Scenario: FTS query uses the GIN index
- **WHEN** `buildSearchClause` generates a Recognitions subquery with `to_tsvector('English', "searchableText") @@ plainto_tsquery(...)`
- **THEN** PostgreSQL SHALL use the GIN index for the lookup instead of a sequential scan
