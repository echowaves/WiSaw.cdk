## Context

Single constant change — increase the haversine distance threshold used to detect wave boundaries from 50km to 100km.

## Goals / Non-Goals

**Goals:**
- Wider grouping radius for more natural waves

**Non-Goals:**
- Changing the algorithm logic

## Design

Change `DISTANCE_THRESHOLD_KM` from `50` to `100` at line 25 of `autoGroupPhotosIntoWaves.ts`. Also update the `radius` value passed to `createWaveAndAssign` from `50` to `100` to match.
