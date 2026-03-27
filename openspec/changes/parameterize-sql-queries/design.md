## Context

The codebase has two generations of controller code:
- **Newer controllers** (waves, refactored photo-detail endpoints) use parameterized queries: `psql.query('SELECT ... WHERE id = $1', [id])`
- **Older controllers** (feeds, friendships, messages, secrets, contact forms) use string interpolation: `` psql.query(`SELECT ... WHERE uuid = '${uuid}'`) ``

The `database-access-patterns` spec already requires parameterized queries, but 17 controllers violate this. The violation was exposed by production errors where invalid input (`"0"`) reached PostgreSQL and caused `invalid input syntax for type uuid` errors. Some controllers validate inputs (e.g., `getPhotoAllCurr` calls `isValidPhotoId()`), others don't — the validation is inconsistent.

## Goals / Non-Goals

**Goals:**
- Eliminate SQL injection vectors from all 17 affected controllers
- Consistent input validation at the controller boundary for `uuid`, `photoId`, `waveUuid`, and other user-supplied arguments
- Follow the existing pattern established by waves and refactored photo controllers

**Non-Goals:**
- Refactoring query logic, changing return types, or altering controller signatures
- Adding new GraphQL schema validations (AppSync-level)
- Changing the `psql.ts` database client wrapper
- Adding ORM or query-builder libraries

## Decisions

### Decision 1: Parameterize all interpolated values, including numeric ones

Even though `LIMIT ${limit}` and `OFFSET ${offset}` use computed numeric values that are lower risk, they will be parameterized to `LIMIT $N OFFSET $M` for consistency. PostgreSQL accepts parameterized LIMIT/OFFSET.

**Alternative considered**: Only parameterize string values (uuid, searchTerm, description). Rejected because partial parameterization creates a confusing precedent and leaves edge cases.

### Decision 2: Create `isValidDeviceUuid()` as a separate utility

A new `lambda-fns/utilities/isValidDeviceUuid.ts` will validate the device `uuid` field. It uses the same UUID regex as `isValidPhotoId()` but with a distinct name to maintain the naming convention (see data-model-conventions spec — `uuid` is a field name meaning device identity, not a type).

**Alternative considered**: Reuse `isValidPhotoId()` for all UUID validation. Rejected because the function name would be misleading when validating a device `uuid` — it's not a photo ID.

**Alternative considered**: A single generic `isValidUuid()` function. Acceptable but less self-documenting. The domain-specific names make call sites immediately clear about what's being validated.

### Decision 3: Validation at controller entry, not in the dispatcher

Each controller validates its own inputs at the top of `main()`, matching the pattern in `getPhotoAllCurr`, `watchPhoto`, etc. The `index.ts` dispatcher remains a pure routing layer.

**Alternative considered**: Centralize validation in `index.ts` handler dispatch. Rejected because it would couple the dispatcher to input format knowledge and break the current separation of concerns.

### Decision 4: PostGIS functions use parameterized inputs

`feedByDate` currently interpolates `${lon}` and `${lat}` into `ST_MakePoint()`. These will become `ST_MakePoint($1, $2)` with the values in the params array. PostGIS functions work with parameterized queries.

### Decision 5: `searchTerm` uses parameterized `plainto_tsquery()`

`feedForTextSearch` interpolates `searchTerm` into `plainto_tsquery('English', '${searchTerm}')`. This will become `plainto_tsquery('English', $1)`. The `plainto_tsquery` function already strips special tsquery operators, but parameterization prevents any SQL escape from the surrounding query.

## Risks / Trade-offs

- **[Risk] Behavioral change on edge cases** — Some controllers currently accept malformed input that happens to work via string interpolation (e.g., a `uuid` with special characters that gets quoted). With parameterized queries, PostgreSQL handles type casting, which may reject values that previously "worked" by accident.
  → Mitigation: This is the correct behavior. Validation at the boundary will catch these with clear error messages.

- **[Risk] Parameter numbering errors** — Complex queries with many interpolated values (e.g., `messages/send.ts` with 7+ values) require careful `$1, $2, ... $N` numbering.
  → Mitigation: Each file is a straightforward mechanical conversion. Verify with existing tests if available.

- **[Risk] `feedByDate` parallel queries** — `feedByDate` calls `_retrievePhotos` in a `Promise.all` loop with different `daysAgo` values. The parameterized query needs to work identically in this concurrent pattern.
  → Mitigation: Each call creates its own query text and params array — no shared state. Parameterization doesn't change this.
