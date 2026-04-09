## Why

`computeClusterRadius` returns a floating-point number (e.g. `97.79674557169524`) but the `Waves.radius` column is `INTEGER` in PostgreSQL. This causes `invalid input syntax for type integer` errors when auto-grouping photos.

## What Changes

- Round the return value of `computeClusterRadius` to the nearest integer using `Math.round()`

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

_None — this is a bug fix, not a requirement change. The spec already says "radius" without implying fractional precision._

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — one-line change in `computeClusterRadius`
