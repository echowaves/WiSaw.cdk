## Why

Production CloudWatch logs show recurring errors from requests with malformed UUID photo/video IDs in the format `00000000-0000-0000-0000-NNNNN` (where the last segment has fewer than 12 digits). These are partially-converted integer IDs with insufficient zero-padding. The existing `redirectLambdaEdgeFunction` handles pure integer IDs (`/photos/29864`) but not this malformed UUID pattern, so they pass through to AppSync and fail validation.

## What Changes

- Add a new match case in `redirectLambdaEdgeFunction` to detect malformed UUIDs matching the pattern `00000000-0000-0000-0000-{1-11 digits}` and 301 redirect to the correctly zero-padded UUID equivalent.
- This complements the existing integer-to-UUID redirect — same logic, different input format.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `seo`: Adding a new redirect requirement for malformed UUID URLs alongside the existing integer ID redirect.

## Impact

- **Code**: `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js` — one additional match case.
- **Infrastructure**: Lambda@Edge function redeploy (CloudFront propagation).
- **Risk**: Minimal — only affects URLs that would otherwise error. Legitimate UUIDs always have exactly 12 hex digits in the last segment and won't match.
