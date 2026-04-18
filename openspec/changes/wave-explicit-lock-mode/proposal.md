## Why

Wave mutability is currently derived only from date windows (`splashDate`/`freezeDate`). That works for most cases, but product needs an explicit owner-controlled freeze override for operational moderation: force-freeze or force-unfreeze photo/comment activity regardless of schedule.

## What Changes

- Add persisted explicit freeze mode on `Waves`: `AUTO`, `FROZEN`, `UNFROZEN` (default `AUTO`)
- Define effective photo/comment freeze as precedence logic:
  - `FROZEN` => frozen
  - `UNFROZEN` => unfrozen
  - `AUTO` => date-derived (`now < splashDate OR now > freezeDate`)
- Restrict override scope to photo/comment mutability flows only (wave-level metadata and other role/admin operations keep existing rules)
- Add owner-only mutation support for setting freeze mode explicitly
- Expose explicit freeze mode in Wave API responses so facilitators can see manual state
- Keep date schedule fields and date-derived state in place; explicit mode acts as an override, not a replacement

## Capabilities

### New Capabilities

- `wave-explicit-locking`: Owner-controlled explicit freeze override with precedence rules and visibility semantics

### Modified Capabilities

- `wave-lifecycle`: Extend lifecycle semantics from date-only to date-plus-explicit override for photo/comment flows
- `waves`: Add owner-only freeze-mode updates and Wave response field for explicit state visibility
- `comments`: Update frozen checks to use effective freeze state (including explicit override)
- `owner-frozen-photo-delete`: Reconcile frozen-photo delete behavior with explicit override precedence

## Impact

- Database: add new `Waves` freeze mode column and backfill default `AUTO`
- GraphQL API: Wave type adds explicit freeze mode field; mutation surface adds owner-only freeze mode update
- Controllers/helpers: update `_isWaveFrozen`, `_assertNotFrozen`, and photo/comment frozen checks to use effective freeze precedence
- Specs: add new `wave-explicit-locking` capability and update affected existing capabilities listed above
