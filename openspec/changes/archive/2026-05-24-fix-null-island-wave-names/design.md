## Context

Wave naming falls back to `formatCoordinates()` when all geocoding strings (locality, region, country) are null. Three call sites hardcode `(0, 0)` instead of using available coordinates.

## Goals / Non-Goals

**Goals:**
- Eliminate "0.0°N, 0.0°E" wave names
- Use actual photo/wave coordinates in the fallback

**Non-Goals:**
- Changing when the coordinate fallback triggers
- Fixing upstream geocoding

## Decisions

### Decision 1: Track anchor coordinates in local state

**Choice**: Store `anchorLat`/`anchorLon` alongside the active wave state so `closeWave()` and the final update can reference them in the fallback path, instead of hardcoding `(0, 0)`.

### Decision 2: "Unlocated" fallback when no coordinates at all

**Choice**: If a photo has both null geo fields AND null coordinates, use `"Unlocated, <Season>"` as the wave name instead of `"0.0°N, 0.0°E, <Season>"`.
