## MODIFIED Requirements

### Requirement: Auto-group Processes All Ungrouped Photos Chronologically

The `autoGroupPhotosIntoWaves` mutation MUST process ALL ungrouped active photos in a single call, ordered by `createdAt` ascending. For each photo:

1. If no active wave exists → create new wave with `createdAt` and `updatedAt` set to the photo's `createdAt`, and `freezeDate` set to the photo's `createdAt`
2. If the passed `groupingLevel` differs from the active wave's stored `groupingLevel` → create new wave (same timestamp rules)
3. If the photo doesn't fit the active wave based on field matching → create new wave (same timestamp rules)
4. Otherwise → add photo to active wave; `_updatePhotosCount` SHALL recalculate `updatedAt = MAX(photo.createdAt)` and `freezeDate = MAX(photo.createdAt)` from the wave's photos

Wave `splashDate` SHALL continue to use season-start boundaries (unchanged).

#### Scenario: Auto-group processes multiple photos

- **GIVEN** 50 ungrouped photos in chronological order
- **WHEN** `autoGroupPhotosIntoWaves(uuid, groupingLevel: CITY)` is called
- **THEN** all 50 photos are processed in the single call
- **AND** photos are distributed across one or more waves based on field matching

#### Scenario: Wave createdAt derives from first photo

- **GIVEN** a user with ungrouped photos, the earliest having `createdAt = "2025-07-01 10:00:00"`
- **WHEN** `autoGroupPhotosIntoWaves` creates a new wave starting with that photo
- **THEN** the wave's `createdAt` SHALL equal `"2025-07-01 10:00:00"`
- **AND** the wave's `updatedAt` SHALL equal `"2025-07-01 10:00:00"`

#### Scenario: Wave updatedAt derives from last photo

- **GIVEN** a wave with photos having `createdAt` values from July 1 through July 15
- **WHEN** `_updatePhotosCount` runs after photos are flushed
- **THEN** the wave's `updatedAt` SHALL equal the `MAX(photo.createdAt)` across all photos in the wave
- **AND** the wave's `freezeDate` SHALL equal the same `MAX(photo.createdAt)`

#### Scenario: Multiple waves get distinct timestamps

- **GIVEN** 100 ungrouped photos spanning two cities, with different photo dates per city
- **WHEN** `autoGroupPhotosIntoWaves` processes them in one batch
- **THEN** each resulting wave SHALL have a distinct `createdAt` derived from its first photo
- **AND** each wave SHALL have a distinct `updatedAt` derived from its last photo

#### Scenario: Photo drift creates new wave

- **GIVEN** an active wave with `anchorLocality="Manhattan"`, `groupingLevel=CITY`
- **WHEN** processing a photo with `locality="Brooklyn"` and `createdAt="2025-07-10 14:00:00"`
- **THEN** a new wave is created with `anchorLocality="Brooklyn"`
- **AND** the new wave's `createdAt` SHALL equal `"2025-07-10 14:00:00"`
- **AND** the Manhattan wave is deactivated

#### Scenario: Wave name refinement does not override updatedAt

- **GIVEN** a wave whose `updatedAt` was set to `MAX(photo.createdAt)` by `_updatePhotosCount`
- **WHEN** `closeWave` runs and updates the wave name and anchor fields
- **THEN** the wave's `updatedAt` SHALL remain at the photo-derived value
- **AND** the UPDATE query in `closeWave` SHALL NOT set `updatedAt`

#### Scenario: No ungrouped photos

- **WHEN** `autoGroupPhotosIntoWaves` is called and no ungrouped photos exist
- **THEN** result has `photosGrouped=0`, `photosRemaining=0`, `hasMore=false`

#### Scenario: Grouping level change creates new wave

- **GIVEN** an active wave with `groupingLevel=CITY`
- **WHEN** `autoGroupPhotosIntoWaves` is called with `groupingLevel=REGION`
- **THEN** a new wave is created with `groupingLevel=REGION`
- **AND** the CITY wave is deactivated
- **AND** all ungrouped photos are processed against the new REGION wave

#### Scenario: Incremental auto-grouping across batches preserves timestamps

- **GIVEN** a wave created in a previous auto-group batch with `updatedAt = "2025-07-10"`
- **WHEN** a new batch adds more photos with `createdAt` up to `"2025-07-15"`
- **THEN** `_updatePhotosCount` SHALL update `updatedAt = "2025-07-15"` and `freezeDate = "2025-07-15"`
