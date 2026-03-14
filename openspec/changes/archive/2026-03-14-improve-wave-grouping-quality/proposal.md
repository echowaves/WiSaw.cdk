## Why

The current auto-grouping creates too many small "Uncategorized" waves. When geocoding fails for the oldest temporal cluster, the algorithm creates an "Uncategorized" wave regardless of cluster size. Since clusters are processed oldest-first, a single photo in a remote ocean location becomes its own wave, while a large cluster of 50 photos near a city waits in the queue. This produces a poor user experience: many tiny "Uncategorized" waves cluttering the wave list.

## What Changes

- When geocoding fails for a cluster, do NOT create an "Uncategorized" wave. Instead, assign those photos to the nearest existing wave in time (same logic already used for locationless photos).
- If no existing waves exist yet to absorb the photos, skip the failed cluster and try the next one. This way, the first wave created is likely a named one, and subsequent failed clusters can be absorbed into it.
- Only create an "Uncategorized" catch-all wave as a last resort — when ALL clusters fail geocoding and no named waves can be created.
- Maintain the one-HTTP-call-per-invocation constraint to avoid timeouts.

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Change geocoding failure behavior from creating "Uncategorized" waves to deferring failed-cluster photos until a named wave exists to absorb them

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — restructure the main function to try multiple clusters within an invocation (without multiple HTTP calls), defer geocoding-failed photos
- **APIs**: No changes
- **Data**: Fewer "Uncategorized" waves; previously-uncategorized photos will be absorbed into named waves
