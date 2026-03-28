## Context

The `redirectLambdaEdgeFunction` is a Lambda@Edge function attached as a VIEWER_REQUEST handler on all CloudFront behaviors (default, `photos/*`, `videos/*`). It currently handles two redirect cases: www→apex domain, and integer photo/video IDs→UUID format.

Production logs show a third pattern: URLs like `/photos/00000000-0000-0000-0000-29864` where the last UUID segment has fewer than 12 digits. These originate from an external caller that knows about the integer-to-UUID migration format but has a zero-padding bug (e.g., photo ID `29864` becomes `...0000-29864` instead of `...0000-000000029864`).

## Goals / Non-Goals

**Goals:**
- Redirect malformed UUID URLs to their correctly-padded equivalents via 301
- Eliminate the recurring AppSync validation errors from these requests
- Reuse the existing `convertIntegerIdToUuid` helper already in the edge function

**Non-Goals:**
- Fixing the external caller's bug (out of our control)
- Handling arbitrary malformed UUIDs beyond the known `00000000-0000-0000-0000-{short digits}` pattern

## Decisions

### Match only the known malformed pattern

Use regex `/^\/(photos|videos)\/00000000-0000-0000-0000-(\d{1,11})$/` to match URLs where the last segment has 1-11 digits. This is precise enough to catch the observed pattern without risking false positives on legitimate UUIDs (which have exactly 12 hex characters including letters).

**Alternative**: Match any UUID-like string with a short last segment. Rejected — over-broad, could match other malformed inputs in unexpected ways.

### Place the new check after the existing integer redirect check

The new regex is placed right after the existing `uriMatch` block. Order doesn't matter functionally (a URL can only match one pattern), but grouping redirect logic together keeps the function readable.

### Reuse the existing `convertIntegerIdToUuid` function

The extracted digits from the malformed UUID are the same integer that `convertIntegerIdToUuid` already pads to 12 digits. No new helper needed.

## Risks / Trade-offs

- **Regex complexity in Edge function** → Minimal. The regex is simple and fixed-width. Edge functions have tight size/execution limits but a single additional regex match is negligible.
- **Caching** → 301 redirects are cached by CloudFront and browsers. This is desirable — once a malformed URL is corrected, subsequent requests skip the edge function entirely.
