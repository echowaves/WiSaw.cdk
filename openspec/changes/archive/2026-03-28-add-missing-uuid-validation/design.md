## Context

All AppSync resolvers dispatch to controller functions under `lambda-fns/controllers/`. A shared `assertValidUuid` helper already exists at `lambda-fns/utilities/assertValidUuid.ts` and is imported by most controllers — but 10 controllers validate `photoId` while skipping validation of the device `uuid` parameter. This lets values like `"0"` reach PostgreSQL, causing `invalid input syntax for type uuid` errors.

## Goals / Non-Goals

**Goals:**
- Add `assertValidUuid(uuid, 'uuid')` to all 10 affected controllers before any database access
- Eliminate `invalid input syntax for type uuid` errors caused by malformed device UUIDs

**Non-Goals:**
- Adding validation for parameters other than `uuid` (already covered)
- Changing the `assertValidUuid` implementation itself
- Modifying error handling or response format

## Decisions

**Pattern: Insert validation call before `psql.connect()`**
All controllers follow the same structure: validate inputs → `psql.connect()` → query → `psql.clean()`. The `assertValidUuid(uuid, 'uuid')` call is added in the validation section, before `psql.connect()`. Controllers that already import `assertValidUuid` (for `photoId`) just need the additional call; controllers that don't import it need the import added too.

**No new abstractions**: Each controller gets an explicit `assertValidUuid` call rather than a middleware wrapper. This matches the existing codebase convention where each controller is responsible for its own input validation.

## Risks / Trade-offs

- **[Client breakage]** → Clients sending invalid device UUIDs will now receive an error instead of a silent database failure. This is the desired behavior — invalid UUIDs were never succeeding at the database level anyway.
- **[Missed controllers]** → The audit identified 10 controllers. If new controllers are added later without validation, the same gap could recur. Mitigation: the `input-validation` spec documents the requirement.
