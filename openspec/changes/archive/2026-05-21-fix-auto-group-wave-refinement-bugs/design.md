## Context

`autoGroupPhotosIntoWaves.ts` processes ungrouped photos chronologically, grouping them into waves based on locality matching and distance thresholds. The function:

1. Fetches the user's active wave (if any) and all ungrouped photos ordered by `createdAt ASC`
2. For each photo, checks if it fits in the current wave using `fitsPhotoInWave()` which compares anchor fields with exact string equality
3. If a photo doesn't fit, creates a new wave via `createWaveAndAssign()`
4. Updates date ranges but never updates wave names or anchor fields after creation

The existing spec (`openspec/changes/archive/2026-05-17-semantic-photo-locality/specs/auto-group-photos/spec.md`) defines REQ-5 (wave name from locality) and REQ-3 (granularity distance mapping), but the implementation has bugs that prevent these requirements from working correctly.

## Goals / Non-Goals

**Goals:**
- Wave names are refined based on most frequently occurring locality across all photos in a wave
- Anchor fields (`anchorLocality`, `anchorDistrict`, etc.) are updated when a more common locality appears
- Wave name is persisted to DB after each refinement cycle (not just date range updates)

**Non-Goals:**
- Changing the chronological processing order (photos still processed by `createdAt ASC`)
- Modifying the `_assertGeoBounds` logic or wave unfreezing behavior
- Adding new database columns — all changes use existing anchor fields
- Changing how waves are created/activated/deactivated

## Decisions

**Decision 1: Most-frequent locality for wave naming (user requirement)**

Instead of using only the anchor photo's geocode result, track a frequency map of locality values across all photos in the current wave. When computing or refining the wave name, use the most frequently occurring locality. This ensures that if 8 out of 10 photos are from "Berlin-Mitte" but the first was from "Potsdam", the wave name becomes "Berlin-Mitte, March 2026".

Implementation: Maintain a `localityCounts` map keyed by locality string during photo processing. When refining the name (line 349), look up the most common locality and use it for the new name computation.

**Decision 2: Anchor fields updated on refinement**

When the wave name is refined due to a more common locality appearing, also update the anchor fields in the DB so subsequent photos are matched against the correct locality. This requires adding `anchorLocality`, `anchorDistrict`, etc. to the UPDATE query at line 364.

**Decision 3: Wave name persisted in UPDATE query**

Add `name` to the UPDATE query at line 364 so refined names are actually saved. The current code computes a new name but never writes it.

## Risks / Trade-offs

**Most-frequent locality may differ from anchor photo's locality**
→ This is the desired behavior — it corrects the initial naming when a more common locality appears later. The anchor photo remains the first geolocated photo (for location purposes), but the name reflects the cluster's dominant area.

**Updating anchor fields mid-processing changes matching for subsequent photos**
→ This is intentional and desirable. If 5 photos from "Berlin-Mitte" arrive, then a photo from "Potsdam", the wave should switch to "Berlin-Mitte" as the anchor locality so future Potsdam-area photos are correctly excluded.

