## ADDED Requirements

### Requirement: findMatchingWave skips frozen waves

When searching for an existing wave to reuse, `findMatchingWave` SHALL skip any wave that is currently frozen (as determined by `_isWaveFrozen`). This applies regardless of whether the wave is frozen by date rules (`AUTO` mode) or by explicit override (`FROZEN` mode).

#### Scenario: Old wave with broken dates is skipped

- **GIVEN** an existing wave with `splashDate = freezeDate = "2026-03-15"` (instantly frozen under AUTO)
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the frozen wave is skipped
- **AND** a new wave is created with correct season boundary dates

#### Scenario: Manually frozen wave is skipped

- **GIVEN** an existing wave with `freezeMode = "FROZEN"`
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the manually frozen wave is skipped

#### Scenario: Unfrozen wave in current season is reused

- **GIVEN** an existing wave with season-aligned dates for the current season (unfrozen)
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the unfrozen wave is returned for reuse

#### Scenario: Explicitly unfrozen wave is reused

- **GIVEN** an existing wave with `freezeMode = "UNFROZEN"`
- **AND** a new photo matches the wave's locality, season, and grouping level
- **WHEN** `findMatchingWave` searches for a reusable wave
- **THEN** the wave is returned for reuse (explicit UNFROZEN overrides date rules)
