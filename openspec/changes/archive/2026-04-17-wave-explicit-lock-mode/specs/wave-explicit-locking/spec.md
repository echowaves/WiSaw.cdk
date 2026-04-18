## ADDED Requirements

### Requirement: Explicit freeze mode is persisted on waves
The system SHALL persist an explicit freeze mode on each wave as `AUTO`, `FROZEN`, or `UNFROZEN`. New and existing waves SHALL default to `AUTO` unless explicitly changed by an owner.

#### Scenario: New wave defaults to AUTO
- **WHEN** a wave is created without freeze mode input
- **THEN** stored freeze mode is `AUTO`

#### Scenario: Existing wave backfill preserves behavior
- **WHEN** migrations are applied to existing waves
- **THEN** stored freeze mode is backfilled to `AUTO`

### Requirement: Effective freeze precedence is deterministic
For photo/comment mutability checks, effective freeze state SHALL be resolved with this precedence:
- `FROZEN` => frozen
- `UNFROZEN` => unfrozen
- `AUTO` => frozen if `now < splashDate OR now > freezeDate`, otherwise unfrozen

#### Scenario: Explicit FROZEN overrides active date window
- **WHEN** `freezeMode=FROZEN` and `splashDate <= now <= freezeDate`
- **THEN** effective state is frozen

#### Scenario: Explicit UNFROZEN overrides frozen-by-date window
- **WHEN** `freezeMode=UNFROZEN` and `now < splashDate` or `now > freezeDate`
- **THEN** effective state is unfrozen

#### Scenario: AUTO follows date lifecycle
- **WHEN** `freezeMode=AUTO`
- **THEN** effective state follows date-derived frozen rules

### Requirement: Only owners can change explicit freeze mode
The system SHALL allow only wave owners to set `freezeMode` values (`AUTO`, `FROZEN`, `UNFROZEN`).

#### Scenario: Owner sets freeze mode
- **WHEN** owner updates wave freeze mode
- **THEN** freeze mode is persisted

#### Scenario: Facilitator cannot set freeze mode
- **WHEN** facilitator attempts to update wave freeze mode
- **THEN** request fails with insufficient permissions

### Requirement: Facilitators can observe explicit freeze mode
Wave API responses SHALL include explicit freeze mode so facilitators can see whether state is manual or automatic.

#### Scenario: Facilitator sees freeze mode
- **WHEN** facilitator fetches wave data from existing wave queries
- **THEN** response contains current freeze mode value
