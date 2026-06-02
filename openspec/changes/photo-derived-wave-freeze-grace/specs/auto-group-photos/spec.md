## MODIFIED Requirements

### Requirement: Auto-grouped waves use photo-derived dates for splash/freeze

When `autoGroupPhotosIntoWaves` creates a new wave, the `splashDate` SHALL be set to the first photo's `createdAt`, and the `freezeDate` SHALL be set to the first photo's `createdAt` plus exactly 1 month.

#### Scenario: New auto-grouped wave gets photo-derived dates

- **GIVEN** a user with ungrouped photos, the first from "2026-01-15 10:00:00"
- **WHEN** `autoGroupPhotosIntoWaves` creates a new wave
- **THEN** the wave's splashDate is `"2026-01-15 10:00:00.000"`
- **AND** the wave's freezeDate is `"2026-02-15 10:00:00.000"` (1 month later)

#### Scenario: Adding photos shifts freezeDate forward

- **GIVEN** a wave with freezeDate "2026-02-15 10:00:00.000"
- **AND** a new photo with createdAt "2026-03-20 14:00:00" is added to the wave
- **THEN** the wave's freezeDate is updated to `"2026-04-20 14:00:00.000"` (1 month after the new photo)

#### Scenario: Adding older photos does not shift freezeDate backward

- **GIVEN** a wave with freezeDate "2026-04-20 14:00:00.000"
- **AND** a new photo with createdAt "2026-02-01 08:00:00" is added to the wave
- **THEN** the wave's freezeDate remains `"2026-04-20 14:00:00.000"` (unchanged, since the new photo is older)

#### Scenario: Old waves are not affected

- **GIVEN** an existing wave created before this change with season-based dates
- **WHEN** `autoGroupPhotosIntoWaves` runs
- **THEN** the old wave's splashDate and freezeDate are unchanged

## REMOVED Requirements

### Requirement: Auto-grouped waves use season boundaries for splash/freeze dates
**Reason**: Replaced by photo-derived dates with 1-month grace period
**Migration**: No data migration needed — old waves keep their dates, new waves use the new logic
