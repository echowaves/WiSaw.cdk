## MODIFIED Requirements

### Requirement: Wave lifecycle state combines date rules with explicit override
Wave mutability for photo/comment contribution flows SHALL be determined by explicit freeze mode and schedule dates. Effective freeze precedence SHALL be:
- `FROZEN` => wave is considered frozen
- `UNFROZEN` => wave is considered unfrozen
- `AUTO` => wave is considered frozen when current time is before `splashDate` or after `freezeDate`

#### Scenario: Before splash date with AUTO
- **WHEN** `freezeMode=AUTO` and `now < splashDate`
- **THEN** wave is considered frozen for contribution flows

#### Scenario: After freeze date with AUTO
- **WHEN** `freezeMode=AUTO` and `now > freezeDate`
- **THEN** wave is considered frozen for contribution flows

#### Scenario: Inside active date window with AUTO
- **WHEN** `freezeMode=AUTO` and `splashDate <= now <= freezeDate`
- **THEN** wave is not frozen by date rules

#### Scenario: Explicit FROZEN overrides date window
- **WHEN** `freezeMode=FROZEN`
- **THEN** wave is considered frozen for contribution flows regardless of dates

#### Scenario: Explicit UNFROZEN overrides date window
- **WHEN** `freezeMode=UNFROZEN`
- **THEN** wave is considered unfrozen for contribution flows regardless of dates
