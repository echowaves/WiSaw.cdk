## Why

The `fix-wave-grouping` change introduced a geocoding loop that tries every temporal cluster sequentially until one succeeds. Each Nominatim HTTP call takes 1-3 seconds, so when many clusters fail geocoding, the Lambda exceeds the AppSync 30-second timeout, causing `Execution timed out` errors on the client.

## What Changes

- Remove the geocoding loop — only geocode the oldest temporal cluster (one HTTP call per invocation, matching original performance)
- When geocoding fails for the oldest cluster, name the wave `"Uncategorized, <DateRange>"` instead of skipping it — this prevents an infinite retry loop and keeps the per-invocation time constant
- Keep the `handleUnresolvablePhotos` logic for locationless photos only (runs on the final invocation when no located photos remain, no geocoding involved)

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Change geocoding failure behavior from skip-and-loop to immediate fallback naming; restrict unresolvable handling to locationless photos only

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — remove geocoding loop, use `"Uncategorized"` fallback for geocoding failure, simplify unresolvable flow
- **APIs**: No changes
- **Performance**: Restores constant-time per-invocation (~3-5 sec) regardless of geocoding success rate
