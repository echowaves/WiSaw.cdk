# Auto Group Photos - Bug Fix Deltas

This spec extends the base auto-group-photos spec with bug-fix requirements.

## ADDED Requirements

### Requirement: Wave name refinement by most-frequent locality
Wave name MUST be refined based on the most frequently occurring locality across all photos in a wave, not just the anchor photo's locality. During processing of each photo added to an existing wave, maintain a frequency map of locality values and update the wave name when a new dominant locality emerges.

#### Scenario: Wave name uses most-frequent locality
- **WHEN** auto-grouping processes 10 photos where 8 are from "Berlin-Mitte" and 2 are from "Potsdam"
- **THEN** the wave name reflects "Berlin-Mitte, Month Year", not "Potsdam, Month Year"

### Requirement: Anchor fields updated during processing
When the dominant locality changes during wave processing (e.g., more photos arrive with a different locality than the anchor), the following fields MUST be updated to reflect the new dominant locality: `anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`, and wave location (lat/lon).

#### Scenario: Anchor fields updated during refinement
- **WHEN** a wave anchored on "Potsdam" receives 5 subsequent photos from "Berlin-Mitte"
- **THEN** `anchorLocality` is updated to "Berlin-Mitte" and related anchor fields follow

### Requirement: Wave name persisted after refinement
The UPDATE query for the current wave MUST include the `name` column so refined names are persisted to DB. Previously, only `splashDate`, `freezeDate`, and `updatedAt` were written; `name` was omitted.

#### Scenario: Wave name persisted after refinement
- **WHEN** the final UPDATE query executes at end of auto-grouping (after a name has been refined during photo processing)
- **THEN** the database row contains the refined name, not the original creation name

### Requirement: Photo count updated after each assignment
When a photo is assigned to an existing wave during auto-grouping, `_updatePhotosCount(waveUuid)` MUST be called immediately after the INSERT into `"WavePhotos"` so that the wave's `photosCount` column reflects the current count without waiting for all photos to finish processing.

#### Scenario: Photo count updated mid-processing
- **WHEN** auto-grouping is processing 100 ungrouped photos and photo #50 is inserted into WavePhotos
- **THEN** `_updatePhotosCount` has been called 49 times already, so `photosCount = 49`
