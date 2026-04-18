## ADDED Requirements

### Requirement: Comment mutability uses effective wave freeze
Comment create/delete operations SHALL evaluate effective wave freeze state using explicit freeze precedence (`FROZEN`/`UNFROZEN`/`AUTO`) rather than date checks alone.

#### Scenario: Comment create blocked by explicit FROZEN
- **WHEN** photo belongs to wave with `freezeMode=FROZEN`
- **THEN** `createComment` request fails as frozen

#### Scenario: Comment create allowed by explicit UNFROZEN outside date window
- **WHEN** photo belongs to wave with `freezeMode=UNFROZEN` and date window would otherwise be frozen
- **THEN** `createComment` request succeeds if other validations pass

#### Scenario: Comment delete blocked by explicit FROZEN
- **WHEN** photo belongs to wave with `freezeMode=FROZEN`
- **THEN** `deleteComment` request fails as frozen
