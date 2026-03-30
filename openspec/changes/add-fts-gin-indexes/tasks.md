## Tasks: add-fts-gin-indexes

### Group 1: Database Migration

- [x] **Task 1**: Create migration `migrations/20260330120000-add-fts-gin-indexes.js`
  - `up()`: Create two GIN indexes using raw SQL via `queryInterface.sequelize.query()`:
    1. `idx_Recognitions_metaData_tsvector` on `to_tsvector('English', "metaData"::text)` on `Recognitions`
    2. `idx_Comments_comment_tsvector` on `to_tsvector('English', "comment"::text)` on `Comments`
  - `down()`: Drop both indexes in reverse order
  - Follow migration conventions: `'use strict'`, async/await, raw SQL for FTS indexes
  - Index naming: `idx_<TableName>_<column>_tsvector`
