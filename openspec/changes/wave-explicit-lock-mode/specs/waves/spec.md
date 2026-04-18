## ADDED Requirements

### Requirement: updateWave supports owner-only explicit freeze mode changes
`updateWave` SHALL accept freeze mode updates (`AUTO`, `FROZEN`, `UNFROZEN`) and SHALL allow only owners to change freeze mode.

#### Scenario: Owner sets FROZEN
- **WHEN** owner calls `updateWave` with `freezeMode=FROZEN`
- **THEN** freeze mode is persisted and returned in the updated wave

#### Scenario: Owner resets to AUTO
- **WHEN** owner calls `updateWave` with `freezeMode=AUTO`
- **THEN** freeze mode is persisted as AUTO

#### Scenario: Non-owner freeze mode update rejected
- **WHEN** facilitator or contributor calls `updateWave` with freeze mode input
- **THEN** request fails with permission error

### Requirement: Wave API includes explicit freeze mode visibility
Wave objects returned by existing wave read/mutation operations SHALL include explicit freeze mode alongside computed effective frozen state.

#### Scenario: listWaves includes freeze mode
- **WHEN** user requests `listWaves`
- **THEN** each returned wave contains `freezeMode` and computed `isFrozen`

#### Scenario: getWave includes freeze mode
- **WHEN** user requests `getWave`
- **THEN** returned wave contains `freezeMode` and computed `isFrozen`
