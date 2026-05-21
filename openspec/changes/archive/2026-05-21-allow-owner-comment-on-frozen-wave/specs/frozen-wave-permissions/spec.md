## ADDED Requirements

### Requirement: Owner can comment on photos in frozen waves
The system SHALL allow the owner of a wave (user whose UUID matches `Waves.createdBy`) to create comments on photos belonging to that wave, even when the wave is in a frozen state (`freezeMode = 'FROZEN'` or auto-frozen outside the splash/freeze window).

#### Scenario: Owner comments on own frozen wave
- **WHEN** user A creates a comment on photo P
- **AND** photo P belongs to wave W where `W.createdBy = A` and W is frozen
- **THEN** the comment creation succeeds

### Requirement: Facilitator can comment on photos in frozen waves
The system SHALL allow a facilitator of a wave (user with `WaveUsers.role = 'facilitator'`) to create comments on photos belonging to that wave, even when the wave is in a frozen state.

#### Scenario: Facilitator comments on frozen wave
- **WHEN** user B creates a comment on photo P
- **AND** photo P belongs to wave W where `B` has role `'facilitator'` in W and W is frozen
- **THEN** the comment creation succeeds

### Requirement: Non-owner/non-facilitator cannot comment on frozen waves
The system SHALL continue to block comment creation for users who are neither the owner nor a facilitator of a frozen wave containing the target photo.

#### Scenario: Regular user blocked from commenting on frozen wave
- **WHEN** user C creates a comment on photo P
- **AND** photo P belongs to wave W where `W.createdBy ≠ C` and C is not a facilitator in W, and W is frozen
- **THEN** the comment creation fails with error "Cannot comment on a photo that is in a frozen wave"

### Requirement: Delete requires unfreezing (strict check)
The system SHALL require waves to be unfrozen before comments can be deleted from photos in those waves. This applies regardless of user role.

#### Scenario: Owner cannot delete comments without unfreezing
- **WHEN** the owner of a frozen wave attempts to delete a comment on a photo in that wave
- **THEN** the deletion fails with error "Cannot delete a comment on a photo that is in a frozen wave"
