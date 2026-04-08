## Context

The `updateWave` mutation returns a `Wave` GraphQL type after updating. The `Wave` type includes three computed fields that don't exist as database columns: `isFrozen: Boolean!`, `myRole: String`, and `joinUrl: String`. The `getWave` query correctly populates all three after `plainToClass`, but `update.ts` returns the raw `plainToClass` result without computing them. Since `isFrozen` is non-nullable, this causes a GraphQL error on every successful `updateWave` call.

## Goals / Non-Goals

**Goals:**
- Populate `isFrozen`, `myRole`, and `joinUrl` on the Wave object returned by `updateWave`
- Match the computation logic already used in `getWave.ts`

**Non-Goals:**
- Fetching photos in the update response (not currently done and not reported as an issue)
- Refactoring shared Wave-response construction across controllers
- Changing the GraphQL schema

## Decisions

**Hardcode `myRole` to `'owner'` instead of querying `_getWaveRole`**

`update.ts` already calls `_assertWaveRole(waveUuid, uuid, 'owner')` which throws if the caller isn't an owner. If execution reaches the return, the role is always `'owner'`. No additional DB query needed.

Alternative: Call `_getWaveRole()` like `getWave.ts` does — rejected because it's a redundant query when the role is already known.

**Compute `isFrozen` from the `RETURNING *` row, not the pre-update snapshot**

The function already fetches the pre-update row for the freeze guard. After the `UPDATE ... RETURNING *`, we must use the *returned* row for `isFrozen` so it reflects any `freezeDate`/`splashDate` changes (e.g., unfreezing a wave).

**Compute `joinUrl` using `DEEP_LINK_BASE_URL` env var**

Same pattern as `getWave.ts`: if `open === true`, construct the deep link; otherwise `null`.

## Risks / Trade-offs

[Drift between getWave and updateWave response construction] → Accepted for now. A shared helper would reduce drift but is out of scope for this bug fix. Both controllers are small and the logic is three lines.
