## Context

The `updateWave` mutation has a three-layer architecture:
1. **GraphQL Schema** (`graphql/schema.graphql`) — defines the public API contract
2. **Lambda Handler** (`lambda-fns/index.ts`) — maps GraphQL args to controller function args
3. **Controller** (`lambda-fns/controllers/waves/update.ts`) — executes the SQL UPDATE

The schema has diverged from the handler/controller. The handler and controller have supported `open`, `splashDate`, `freezeDate`, and `freezeMode` since the `2026-04-08-wave-date-lifecycle` and `2026-04-17-wave-explicit-lock-mode` changes. The schema was never updated to match.

## Goals / Non-Goals

**Goals:**
- Add the 4 missing parameters to the `updateWave` mutation in the GraphQL schema
- Ensure the schema matches what the handler and controller already expect

**Non-Goals:**
- No changes to handler, controller, or resolver logic
- No new features or behavior changes
- No database or migration changes

## Decisions

**Decision 1: Add all 4 parameters at once**

Add `open: Boolean`, `splashDate: String`, `freezeDate: String`, `freezeMode: String` to the mutation signature.

**Rationale**: These were all part of previously implemented changes. Adding them together restores the intended API surface without partial states.

**Decision 2: Use `String` for date types (not `AWSDateTime`)**

The schema uses `String` for `splashDate` and `freezeDate` in `createWave` (line 412-413 of schema). Keep consistency.

**Rationale**: The handler passes these as strings to the controller which formats them via moment.js. Changing to `AWSDateTime` would require handler/controller changes too — out of scope.

## Risks / Trade-offs

[Risk: Schema change requires GraphQL redeployment] → Mitigation: This is a non-breaking addition (new optional parameters). Existing clients continue to work.
[Risk: Schema drift could recur] → Mitigation: Consider adding a CI check that validates schema ↔ handler ↔ controller consistency.
