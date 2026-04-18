## ADDED Requirements

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

### Requirement: Frozen checks use shared helpers
The implementation SHALL use `_isWaveFrozen(wave)` and `_assertNotFrozen(wave)` to gate mutating operations that require a mutable wave.

#### Scenario: Helper-based mutation guard
- **WHEN** a wave mutation path requires mutability
- **THEN** the path uses helper checks rather than duplicating date logic inline

### Requirement: Frozen protection applies to photo/comment flows
If a photo belongs to a frozen wave, create/delete comment and global delete-photo operations are blocked by shared frozen checks, with implemented owner exceptions in wave-role-specific paths.

#### Scenario: Comment create blocked
- **WHEN** `createComment` targets a photo in frozen wave
- **THEN** request fails

#### Scenario: Comment delete blocked
- **WHEN** `deleteComment` targets a photo in frozen wave
- **THEN** request fails

#### Scenario: Non-owner photo delete blocked in frozen wave
- **WHEN** photo belongs to frozen wave and caller is not eligible owner exception path
- **THEN** global delete-photo request fails

### Requirement: Owner exception for full wave deletion
Wave owner can delete a wave even when frozen.

#### Scenario: Frozen wave delete by owner
- **WHEN** owner calls delete on a frozen wave
- **THEN** delete proceeds

### Requirement: Wave API includes computed frozen state
Wave responses include `isFrozen`. The current API does not include `isActive` and does not persist a separate `frozen` boolean field.

#### Scenario: API Shape Excludes `isActive`
- **WHEN** wave object is returned through GraphQL
- **THEN** client gets `isFrozen` but not `isActive`