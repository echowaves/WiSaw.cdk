## Why

Auto-grouped waves currently hardcode `radius = 100` (km) regardless of how spread out the cluster's photos actually are. If the wave is later unfrozen, the geo-fence may be too large (wasting boundary space) or poorly fitted to the actual photo distribution. The wave should have a radius derived from the cluster's spatial spread so the geo-fence meaningfully represents the area the photos cover.

## What Changes

- Compute the wave's radius from the maximum distance between the anchor photo and any other geolocated photo in the cluster, plus a buffer margin
- Use a minimum radius floor (e.g. 5km) so single-photo or very tight clusters still get a usable geo-fence
- Keep the anchor photo (first geolocated photo by `createdAt`) as the wave's location — no change to location logic

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: The "Auto-group creates a wave for each cluster" requirement changes — radius is computed from cluster spread instead of hardcoded

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — compute radius from max haversine distance to anchor, pass to `createWaveAndAssign`
