## Why

The malformed UUID redirect introduced in `broaden-malformed-uuid-redirect` has an infinite redirect loop bug. A correctly formatted UUID like `00000000-0000-0000-0000-000000029864` gets its zeros and dashes stripped to `29864`, passes the digits-only test, and redirects back to the same URL — causing an infinite 301 loop. The fix is to compare the reconstructed UUID against the original ID and skip the redirect when they match.

## What Changes

- Add a guard in the malformed ID redirect block in `redirectLambdaEdgeFunction` that compares the generated UUID to the original ID segment. If they match, the URL is already correct and should pass through.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `seo`: Adding a guard condition to the malformed UUID redirect requirement to prevent infinite redirects on already-correct UUIDs.

## Impact

- **Code**: `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js` — one additional condition in the existing `if` block.
- **Severity**: Critical — the current code causes infinite redirect loops for all properly formatted migration UUIDs.
