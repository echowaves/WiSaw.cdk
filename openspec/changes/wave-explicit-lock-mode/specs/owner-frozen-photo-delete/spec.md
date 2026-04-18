## ADDED Requirements

### Requirement: Frozen-wave delete-photo checks use effective freeze
Photo delete protection SHALL use effective wave freeze state with explicit freeze precedence. Non-owner callers SHALL be blocked only when effective state is frozen.

#### Scenario: Non-owner blocked by explicit FROZEN
- **WHEN** caller is not owner and photo belongs to wave with `freezeMode=FROZEN`
- **THEN** deletion is rejected as frozen-wave protected

#### Scenario: Non-owner allowed by explicit UNFROZEN
- **WHEN** caller is not owner and photo belongs to wave with `freezeMode=UNFROZEN` while date rule would be frozen
- **THEN** deletion proceeds with normal photo-delete behavior

#### Scenario: AUTO keeps existing behavior
- **WHEN** wave has `freezeMode=AUTO`
- **THEN** frozen-wave delete protections follow date-derived freeze behavior
