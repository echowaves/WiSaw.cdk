## Why

The `updateWave` resolver cannot distinguish between "field not provided" (absent from the mutation) and "field explicitly set to null" (variable declared but not supplied). When a client declares GraphQL variables it doesn't use, AppSync sends them as `null` in `event.arguments`. The resolver checks `!== undefined`, so `null` passes through, causing two bugs:

1. **False rejection on frozen waves** — the `hasNonFreezeChanges` guard treats leaked nulls as intentional changes and blocks legitimate freezeDate-only updates.
2. **Unintentional NULL writes** — nullable fields like `description` get overwritten to NULL in the database when the client never intended to change them.

## What Changes

- All optional-field checks in the `updateWave` resolver switch from `!== undefined` to `!= null` (loose equality), treating both `undefined` and `null` as "not provided".
- The `description` field gains explicit "clear" semantics: sending an empty string `""` sets the database column to NULL, while `null`/absent means "no change".
- The `name` field validation is tightened to match: `!= null` instead of `!== undefined && !== null`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `waves`: The `updateWave` mutation changes how it interprets null and empty-string inputs for optional fields.
- `input-validation`: The null-vs-absent convention for PATCH-style mutations is clarified.

## Impact

- **Code**: `lambda-fns/controllers/waves/update.ts` — all conditional checks for optional fields.
- **API contract**: Clients that intentionally send `null` to clear a field must now send `""` instead (for `description`). All other nullable fields (`open`, `splashDate`, `freezeDate`) should never be cleared, so no behavioral change for well-behaved clients.
- **No database changes.**
- **No infrastructure changes.**
