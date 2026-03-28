## Context

The `redirectLambdaEdgeFunction` currently has two redirect cases for photo/video IDs:
1. Pure integer: `/photos/29864` → `/photos/00000000-0000-0000-0000-000000029864`
2. Short-padded UUID: `/photos/00000000-0000-0000-0000-29864` → `/photos/00000000-0000-0000-0000-000000029864`

A third variant has appeared: `/photos/00000000-0000-0000-0000-0000000-29864` — extra dashes within the zero-padded portion. Rather than adding pattern-by-pattern, we generalize.

## Goals / Non-Goals

**Goals:**
- Catch all malformed IDs that consist of zeros and dashes followed by a trailing integer
- Extract the integer, convert to proper UUID, 301 redirect
- Replace the narrow `malformedUuidMatch` with the broader pattern

**Non-Goals:**
- Changing the pure-integer redirect (case 1) — it already works
- Handling IDs that contain hex letters (a-f) — those are real UUIDs, not migration artifacts

## Decisions

### Use a regex that matches zeros-and-dashes prefix followed by trailing digits

Pattern: `/^\/(photos|videos)\/((?:0+-?)+?)(\d+)$/` — but this is tricky with greedy/lazy matching.

Simpler approach: instead of a complex regex, strip all `0`s and `-`s from the ID string, check if what remains is a pure integer, and redirect.

```js
const id = uri segment after /photos/ or /videos/
const stripped = id.replace(/[0-]/g, '')
if (/^\d+$/.test(stripped) && stripped.length > 0 && id !== stripped) {
  redirect to convertIntegerIdToUuid(stripped)
}
```

This handles:
- `00000000-0000-0000-0000-29864` → stripped: `29864` → redirect
- `00000000-0000-0000-0000-0000000-29864` → stripped: `29864` → redirect
- `0-0-0-0-29864` → stripped: `29864` → redirect
- `29864` → stripped: `29864` but `id === stripped`? No, id would be `29864` which is already caught by the integer match above
- `a1b2c3d4-...` → stripped contains letters → `\d+` test fails → no redirect

**Why not regex**: The number of dash/zero arrangements is arbitrary. A structural strip-and-test approach is more robust than enumerating patterns.

**Safety**: After stripping, we verify the result is non-empty digits. Legitimate UUIDs contain hex letters (a-f) which survive the strip and fail the digits-only test.

### Keep the pure-integer redirect as-is

Case 1 (`/photos/29864`) is already handled cleanly by the existing `uriMatch`. The new broader check is placed after it, replacing the narrow `malformedUuidMatch`.

## Risks / Trade-offs

- **Over-matching** → An ID like `000` (all zeros, no trailing integer) would strip to empty string — the `stripped.length > 0` guard handles this. An ID like `0` strips to empty — also safe.
- **Performance** → String replace + regex test on every request that doesn't match earlier checks. Negligible cost — runs only when the first two checks fail.
