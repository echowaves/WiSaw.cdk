## Context

The malformed ID redirect strips all `0` and `-` characters from the photo/video ID, checks if the remainder is digits-only, and redirects to the correctly formatted UUID. The problem: a valid UUID like `00000000-0000-0000-0000-000000029864` strips to `29864`, which is digits-only, so `convertIntegerIdToUuid('29864')` produces `00000000-0000-0000-0000-000000029864` — the exact same ID — causing an infinite redirect.

## Goals / Non-Goals

**Goals:**
- Prevent infinite redirect loops when the URL already contains a correctly formatted UUID

**Non-Goals:**
- Changing the strip-and-test approach itself — it correctly handles the malformed cases

## Decisions

### Compare reconstructed UUID to original ID

After computing `uuid = convertIntegerIdToUuid(stripped)`, compare `uuid === id`. If they match, the URL is already correct — skip the redirect and let the request pass through to the origin.

This is the simplest fix: one additional condition, no structural changes.

## Risks / Trade-offs

- **None** — this is a pure bug fix adding a safety guard. No behavior change for malformed URLs; only prevents the loop for already-correct ones.
