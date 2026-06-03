## Context

The `updateWave` and `createWave` GraphQL mutations have a three-layer architecture:
1. **GraphQL Schema** (`graphql/schema.graphql`) — defines the public API contract
2. **Lambda Handler** (`lambda-fns/index.ts`) — maps GraphQL args to controller function args
3. **Controller** (`lambda-fns/controllers/waves/*.ts`) — executes the SQL UPDATE/INSERT and returns `Wave` objects

The schema has diverged from the handler/controller:
- `updateWave` declares `splashDate: String`, `freezeDate: String`, `freezeMode: String` but the controller accepts `string` and passes them to PostgreSQL (which handles ISO 8601 strings fine)
- `updateWave` and `createWave` return `Boolean!` but controllers return `Promise<Wave>` (the `Wave` type already has correct types: `splashDate: AWSDateTime!`, `freezeDate: AWSDateTime!`, `freezeMode: WaveFreezeMode!`)
- `createWave` is missing `splashDate` and `freezeDate` parameters entirely, yet the handler passes them via `getArgs`

## Goals / Non-Goals

**Goals:**
- Align `updateWave` and `createWave` schema types with the actual controller behavior and `Wave` type
- Add missing `splashDate`/`freezeDate` to `createWave` mutation
- Change return type from `Boolean!` to `Wave!` for both mutations

**Non-Goals:**
- No changes to handler, controller, resolver, or model logic
- No database or migration changes
- No changes to other mutations

## Decisions

**Decision 1: Use `AWSDateTime` for date parameters (not `String`)**

The `Wave` type already declares `splashDate: AWSDateTime!` and `freezeDate: AWSDateTime!`. The schema should match. `AWSDateTime` in AppSync is an ISO 8601 string — the controller passes these as strings to PostgreSQL which handles them correctly.

**Rationale**: Consistency with the `Wave` type. No handler/controller changes needed since they already receive strings.

**Decision 2: Use `WaveFreezeMode` enum for `freezeMode` parameter**

The `Wave` type declares `freezeMode: WaveFreezeMode!`. The schema should match. The controller calls `_normalizeFreezeMode()` which accepts strings — the enum just restricts allowed values at the GraphQL layer.

**Rationale**: Type safety at the GraphQL layer. Existing string values (`AUTO`, `FROZEN`, `UNFROZEN`) map directly to the enum values.

**Decision 3: Change return type from `Boolean!` to `Wave!`**

Both controllers return `plainToClass(Wave, row)` — actual `Wave` objects. The AppSync Lambda resolver passes through the Lambda return value directly. The schema should reflect reality.

**Rationale**: Clients can now read back updated wave fields (e.g., `splashDate`, `freezeMode`) directly from the mutation response without a follow-up query.

## Risks / Trade-offs

[Risk: `Wave!` return type is a breaking change for clients that expect `Boolean`] → Mitigation: This is a fix for a broken API — clients can't actually use the current `Boolean!` return meaningfully. Existing clients that ignore the return value continue to work.

[Risk: `AWSDateTime` format mismatch] → Mitigation: `AWSDateTime` is ISO 8601, which is what the controller already passes to PostgreSQL. No format change needed.

[Risk: Schema drift could recur] → Mitigation: Consider adding a CI check that validates schema ↔ handler ↔ controller consistency.
