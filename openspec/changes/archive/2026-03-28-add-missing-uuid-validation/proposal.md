## Why

Production PostgreSQL errors show `invalid input syntax for type uuid: "0"` — invalid device `uuid` values are reaching the database. The `input-validation` spec already requires every controller accepting a device `uuid` to validate it with `assertValidUuid`, but 10 controllers only validate `photoId` and skip `uuid` validation.

## What Changes

- Add `assertValidUuid(uuid, 'uuid')` calls to the 10 controllers that currently skip device UUID validation:
  - `photos/create.ts`
  - `photos/delete.ts`
  - `photos/watch.ts`
  - `photos/unwatch.ts`
  - `photos/getPhotoDetails.ts`
  - `comments/create.ts`
  - `comments/delete.ts`
  - `abuseReports/create.ts`
  - `secrets/update.ts`
  - `messages/generateUploadUrlForMessage.ts`
- Each call must occur before any database access (`psql.connect()` / `psql.query()`)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `input-validation`: No requirement changes — the spec already mandates device `uuid` validation. This change brings the implementation into compliance.

## Impact

- **Code**: 10 controller files under `lambda-fns/controllers/`; some will also need a new `import` for `assertValidUuid`
- **APIs**: GraphQL mutations/queries that accept a device `uuid` will now return an error for malformed values instead of letting them reach PostgreSQL
- **Risk**: Low — adds early validation that prevents invalid data from reaching the database; no behavior change for valid inputs
