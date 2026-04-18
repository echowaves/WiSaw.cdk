## 1. Database Schema

- [x] 1.1 Add migration to create `Waves.freezeMode` (string/enum-like) with default `AUTO` and non-null constraint
- [x] 1.2 Add migration-safe backfill verification for existing rows (`AUTO`) and define down migration to remove freeze mode
- [x] 1.3 Validate migration naming and logging conventions for `migrations/**`

## 2. Domain Model and Freeze Resolution Helpers

- [x] 2.1 Update wave model shape to include `freezeMode`
- [x] 2.2 Refactor freeze-resolution helper(s) so effective frozen state uses precedence (`FROZEN`/`UNFROZEN`/`AUTO+dates`)
- [x] 2.3 Update `_assertNotFrozen` and other shared wave freeze helpers to consume effective freeze resolution

## 3. Wave Controller and Mutation Updates

- [x] 3.1 Extend wave update flow with owner-only `freezeMode` input handling and persistence
- [x] 3.2 Keep existing frozen-state restrictions for non-photo/comment operations unchanged
- [x] 3.3 Ensure wave read/update responses include both computed effective frozen state and explicit `freezeMode`

## 4. Photo and Comment Enforcement Paths

- [x] 4.1 Update wave photo mutability checks (add/remove/move) to use effective freeze precedence
- [x] 4.2 Update global frozen-photo delete guard to use effective freeze precedence while preserving owner exception semantics
- [x] 4.3 Update comment create/delete frozen-wave checks to use effective freeze precedence

## 5. GraphQL Contract and Resolver Wiring

- [x] 5.1 Update `graphql/schema.graphql` Wave type and `updateWave` mutation arguments for `freezeMode`
- [x] 5.2 Update dispatcher wiring in `lambda-fns/index.ts` to pass `freezeMode` to controllers
- [x] 5.3 Confirm resolver mapping in `lib/resources/resolvers.ts` remains consistent for updated GraphQL operations

## 6. Verification

- [x] 6.1 Add/adjust unit and integration tests for freeze precedence and owner-only freeze mode updates
- [x] 6.2 Add coverage for facilitator visibility of `freezeMode` in wave query responses
- [x] 6.3 Run lint/tests and verify no regressions in existing wave/date lifecycle behavior when `freezeMode=AUTO`
