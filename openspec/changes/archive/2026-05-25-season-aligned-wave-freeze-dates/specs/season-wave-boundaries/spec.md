## ADDED Requirements

### Requirement: Season boundary date computation

The system SHALL provide a `getSeasonBoundaries(seasonKey)` function that computes exact calendar start and end timestamps for a given season key.

The splash date SHALL be the first moment of the first day of the season (`00:00:00.000`).
The freeze date SHALL be the last moment of the last day of the season (`23:59:59.999`), using `moment().endOf('month')` to handle leap years.

Season boundary mapping:

| Season Key | Splash Date | Freeze Date |
|---|---|---|
| `YYYY-WINTER` | Dec 1 of year YYYY | End of Feb of year YYYY+1 |
| `YYYY-SPRING` | Mar 1 of year YYYY | End of May of year YYYY |
| `YYYY-SUMMER` | Jun 1 of year YYYY | End of Aug of year YYYY |
| `YYYY-FALL` | Sep 1 of year YYYY | End of Nov of year YYYY |

#### Scenario: Spring season boundaries

- **WHEN** `getSeasonBoundaries("2026-SPRING")` is called
- **THEN** splashDate is `"2026-03-01 00:00:00.000"`
- **AND** freezeDate is `"2026-05-31 23:59:59.999"`

#### Scenario: Winter season boundaries spanning year

- **WHEN** `getSeasonBoundaries("2025-WINTER")` is called
- **THEN** splashDate is `"2025-12-01 00:00:00.000"`
- **AND** freezeDate is `"2026-02-28 23:59:59.999"`

#### Scenario: Winter season boundaries with leap year

- **WHEN** `getSeasonBoundaries("2027-WINTER")` is called
- **THEN** freezeDate is `"2028-02-29 23:59:59.999"`

#### Scenario: Summer season boundaries

- **WHEN** `getSeasonBoundaries("2026-SUMMER")` is called
- **THEN** splashDate is `"2026-06-01 00:00:00.000"`
- **AND** freezeDate is `"2026-08-31 23:59:59.999"`

#### Scenario: Fall season boundaries

- **WHEN** `getSeasonBoundaries("2026-FALL")` is called
- **THEN** splashDate is `"2026-09-01 00:00:00.000"`
- **AND** freezeDate is `"2026-11-30 23:59:59.999"`

### Requirement: Auto-grouped waves use season boundaries for splash/freeze dates

When `autoGroupPhotosIntoWaves` creates a new wave, the `splashDate` and `freezeDate` SHALL be set to the season boundary dates computed from the wave's season key, NOT the photo's `createdAt`.

#### Scenario: New auto-grouped wave in current season is unfrozen

- **GIVEN** the current date is May 25, 2026
- **WHEN** `autoGroupPhotosIntoWaves` creates a wave for a Spring 2026 photo
- **THEN** the wave's splashDate is `"2026-03-01 00:00:00.000"`
- **AND** the wave's freezeDate is `"2026-05-31 23:59:59.999"`
- **AND** the wave is NOT frozen (since `splashDate <= now <= freezeDate`)

#### Scenario: New auto-grouped wave for past season is frozen

- **GIVEN** the current date is May 25, 2026
- **WHEN** `autoGroupPhotosIntoWaves` creates a wave for a Winter 2025 photo
- **THEN** the wave's splashDate is `"2025-12-01 00:00:00.000"`
- **AND** the wave's freezeDate is `"2026-02-28 23:59:59.999"`
- **AND** the wave IS frozen (since `now > freezeDate`)
