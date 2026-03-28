## Why

The malformed UUID redirect added previously only matches the pattern `00000000-0000-0000-0000-{1-11 digits}` (short last segment). Production URLs show additional malformed variants like `00000000-0000-0000-0000-0000000-29864` where the zeros-and-dashes structure varies arbitrarily. The current narrow regex misses these. A broader pattern — any combination of `0`s separated by `-`, followed by a trailing integer — would catch all observed and potential variants from the misconfigured caller.

## What Changes

- Replace the current narrow malformed UUID regex in `redirectLambdaEdgeFunction` with a broader pattern that matches any ID composed of zeros and dashes ending with a non-zero integer, and redirects to the correctly formatted UUID.
- The existing pure-integer redirect (`/photos/29864`) remains unchanged — it handles the simplest case already.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `seo`: Broadening the malformed UUID redirect requirement to cover any zeros-and-dashes prefix followed by an integer.

## Impact

- **Code**: `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js` — replace the `malformedUuidMatch` regex.
- **Infrastructure**: Lambda@Edge function redeploy (CloudFront propagation).
- **Risk**: Minimal — the pattern only matches IDs composed entirely of `0`s, `-`, and trailing digits. Legitimate UUIDs contain hex letters (a-f) and won't match.
