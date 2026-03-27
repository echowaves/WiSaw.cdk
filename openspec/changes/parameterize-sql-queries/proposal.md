## Why

17 controller files use string interpolation (`'${variable}'`) to embed user-supplied values directly into SQL query text instead of using parameterized queries (`$1, $2`). This creates SQL injection vulnerabilities on every affected endpoint. The issue surfaced during investigation of production errors (`invalid input syntax for type uuid: "0"`) where unvalidated input reached PostgreSQL because `feedForWatcher` interpolates the device `uuid` directly into a WHERE clause. Newer controllers (waves, refactored photo-detail controllers) already use parameterized queries — the older code was never migrated.

## What Changes

- **Convert all 17 controllers from string interpolation to parameterized queries** — replace every `'${variable}'` and `${variable}` in SQL template literals with `$N` placeholders and pass values via the params array
- **Add input validation at the resolver boundary** — controllers that accept a device `uuid`, `photoId`, or `waveUuid` but skip format validation will gain `isValidPhotoId()` or `uuidValidate()` checks before any database access
- **Add a `isValidDeviceUuid()` utility** — a validation function for the device `uuid` field, parallel to the existing `isValidPhotoId()` for photo IDs

## Capabilities

### New Capabilities
- `input-validation`: Centralized input validation rules for GraphQL resolver arguments (uuid, photoId, waveUuid, searchTerm, numeric params) applied consistently at the controller boundary

### Modified Capabilities
- `database-access-patterns`: The "All queries use parameterized SQL" requirement already exists in the spec but is violated by 17 controllers — this change enforces compliance
- `photo-feed`: Feed controllers (feedByDate, feedForWatcher, feedForTextSearch, feedRecent) will be updated to use parameterized queries
- `friendships`: All 5 friendship controllers will be converted to parameterized queries
- `chat-messages`: All 4 message controllers will be converted to parameterized queries
- `user-identity`: register and update secret controllers will be converted to parameterized queries
- `contact-forms`: createContactForm will be converted to parameterized queries

## Impact

- **Code**: 17 files across `lambda-fns/controllers/` (photos/feed*, contactForms/, friendships/, messages/, secrets/)
- **New utility**: `lambda-fns/utilities/isValidDeviceUuid.ts`
- **APIs**: No GraphQL schema changes — all resolvers keep the same signatures and return types
- **Behavior**: Invalid inputs that previously reached PostgreSQL and caused DB errors will now be caught earlier with clear validation errors
- **Risk**: Low — parameterized queries produce identical SQL results; validation adds a stricter boundary but all valid inputs will continue to work
