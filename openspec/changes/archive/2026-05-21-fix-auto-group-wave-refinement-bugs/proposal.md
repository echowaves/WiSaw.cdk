## Why

Auto-grouped waves have several bugs that prevent them from producing meaningful names and proper geo-fences: wave names are frozen at creation time instead of being refined as more photos join, anchor fields never update when a more common locality appears, the wave name is computed but never persisted to DB, and `_updatePhotosCount` is only called once at the end of processing — photos added mid-loop never update the wave's photo count until all processing completes.

## What Changes

- Wave name is refined based on most frequently occurring locality across all photos in a wave
- Anchor fields (`anchorLocality`, `anchorDistrict`, etc.) are updated when a more common locality appears during processing
- Wave name and anchor fields are persisted to DB after each refinement cycle
- Wave photo count is updated after each photo assignment (not just at the end)

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `auto-group-photos`: Wave naming now uses most-frequent locality; anchor fields are updated during processing; wave photo count is updated after each photo assignment

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — add locality frequency tracking, refined UPDATE query with name/anchor fields/photoCount
- `openspec/changes/archive/2026-05-17-semantic-photo-locality/specs/auto-group-photos/spec.md` (delta spec) — add REQ-5a, REQ-8a, REQ-8b and tests T10-T12
