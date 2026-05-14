## Context

`autoGroupPhotosIntoWaves` currently groups a user's ungrouped photos by walking through them in chronological order and collecting those within 100km of the first geolocated photo (the anchor). The threshold `DISTANCE_THRESHOLD_KM` is hardcoded as a module-level constant.

The wave's stored `radius` field is computed *after* grouping via `computeClusterRadius()` — it's a result property (geo-fence), not an input.

## Goals / Non-Goals

**Goals:**
- Make the grouping threshold configurable via an optional `radius` parameter
- Preserve current behavior (100km) as the default

**Non-Goals:**
- Changing the grouping algorithm (anchor-walk stays as-is)
- Adding a preview UI or listPhotoLocations coupling
- Changing how the wave's stored radius is computed

## Decisions

### 1. Use optional parameter, not required

```graphql
autoGroupPhotosIntoWaves(
  uuid: String!
  radius: Int    # optional, defaults to 100
): AutoGroupResult!
```

Rationale: Backwards compatible. Existing callers (if any) continue working. The client can add the parameter when ready without breaking existing integrations.

### 2. Default to 100, not 50

The current hardcoded value is 100km. Changing the default would alter behavior for all existing callers. We preserve the status quo.

### 3. No validation clamping

The radius is passed directly to `haversineDistance()` comparison. No min/max clamping — the client controls the value. If a client passes 1, every photo becomes its own wave. If it passes 10000, everything groups together. This is intentional — the client knows its user's needs.

### 4. `computeClusterRadius()` unchanged

The output radius (stored on Wave for geo-fencing) continues to be computed from actual photo spread. Input radius and output radius serve different purposes and should not be conflated.

## Risks / Trade-offs

[Risk] Client passes an unreasonably large radius → all photos grouped into one wave.
[Trade-off] Acceptable. The client can clamp if desired. The server trusts the client.

[Risk] Client passes 0 or negative → no photos collected (0km threshold).
[Trade-off] The loop `distance <= radius` with radius=0 means only photos exactly at the anchor's coordinates are included. This is an edge case the client should handle. No server-side clamping needed.
