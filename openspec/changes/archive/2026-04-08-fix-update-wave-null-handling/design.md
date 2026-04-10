## Context

The `updateWave` resolver in `lambda-fns/controllers/waves/update.ts` uses `!== undefined` to detect whether optional fields were provided. This fails when AppSync sends `null` for GraphQL variables that are declared but not supplied — a valid client behavior. The resolver treats those nulls as intentional updates, causing false frozen-wave rejections and unintentional NULL writes.

The fix is confined to a single file. No architectural changes, no new dependencies, no migrations.

## Goals / Non-Goals

**Goals:**
- Make `updateWave` treat both `null` and `undefined` as "field not provided"
- Provide a way to explicitly clear the `description` field (send `""` → stored as NULL)
- Fix the frozen-wave guard so it doesn't false-positive on leaked nulls

**Non-Goals:**
- Changing the GraphQL schema (all fields remain nullable scalars)
- Adding an input type or changing the mutation signature
- Fixing this pattern in other resolvers (scoped to `updateWave` only)
- Client-side changes (backend should be robust regardless)

## Decisions

**Use `!= null` (loose equality) instead of `!== undefined`**

All optional-field checks switch to `!= null`, which catches both `null` and `undefined` in one check. This is idiomatic JavaScript for "was a value provided?" and is the simplest change.

Alternative considered: checking `Object.hasOwn(args, fieldName)` at the dispatcher level. Rejected because AppSync includes the key with a `null` value when a variable is declared but unsupplied — key presence doesn't distinguish the two cases.

**Empty string `""` as the "clear" signal for `description`**

When `description` is `""`, the resolver writes `NULL` to the database. This only applies to `description` because it's the only field where clearing to NULL is a valid user intent. Other fields (`name`, `open`, `splashDate`, `freezeDate`) should never be NULL.

Alternative considered: a dedicated `clearFields: [String]` argument. Rejected as over-engineered for a single nullable field.

## Risks / Trade-offs

**[Trade-off] Clients can no longer send `null` to clear description** → They must send `""` instead. This is a minor API contract change. No known client currently sends explicit `null` to clear description — the bug is precisely that `null` arrives unintentionally.

**[Risk] Other resolvers may have the same pattern** → This change only fixes `updateWave`. If the pattern exists elsewhere, it should be addressed separately. Mitigation: this is the only PATCH-style update mutation currently in the schema.
