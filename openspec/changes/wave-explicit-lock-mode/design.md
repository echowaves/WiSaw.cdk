## Context

Wave lock behavior is currently derived only from `splashDate`/`freezeDate` and is consumed by wave-photo and comment mutability guards. Product now requires an explicit owner-controlled override that can force freeze or force unfreeze regardless of schedule, while preserving schedule as the default behavior. The override must be visible to facilitators and scoped only to photo/comment mutability.

## Goals / Non-Goals

**Goals:**
- Add persisted explicit freeze trait on waves with unambiguous precedence over date-derived state
- Keep date schedule (`splashDate`, `freezeDate`) as the default lifecycle source when no explicit override is set
- Restrict explicit override effect to photo/comment mutability flows
- Allow only wave owners to change explicit freeze state
- Expose explicit freeze state in Wave API responses so facilitators can see it

**Non-Goals:**
- Replacing schedule fields with manual lock fields
- Changing wave membership/role model
- Broadening override effect to unrelated wave admin actions (invites, role assignment, wave deletion, metadata updates)
- Introducing time-based auto-reset of explicit freeze mode

## Decisions

### 1. Persist explicit freeze as tri-state mode

**Decision**: Add `freezeMode` on `Waves` with values `AUTO`, `FROZEN`, `UNFROZEN`, default `AUTO`.

**Rationale**: Tri-state mode expresses intent directly and avoids ambiguous combinations from multiple booleans.

**Alternatives considered**:
- Reintroduce `frozen` boolean override: rejected due to ambiguity with date lifecycle and historical dual-source complexity.
- Nullable boolean override (`null|true|false`): rejected because enum values are clearer and safer for API contracts.

### 2. Define effective freeze precedence centrally

**Decision**: Effective photo/comment freeze is resolved by precedence:
- `FROZEN` => frozen
- `UNFROZEN` => unfrozen
- `AUTO` => date-derived (`now < splashDate OR now > freezeDate`)

**Rationale**: Single precedence rule prevents drift across controller paths and gives deterministic behavior.

**Alternatives considered**:
- Date rule always wins: rejected because it cannot satisfy explicit unfreeze requirement.
- Merge logic per controller: rejected due to consistency risk.

### 3. Scope override to photo/comment mutability only

**Decision**: Apply effective freeze checks only to flows that currently rely on frozen-wave mutability for photos/comments:
- add/remove photo in wave
- global delete-photo frozen checks
- create/delete comment frozen checks

**Rationale**: Matches product request and avoids unintended behavior changes in broader wave administration.

**Alternatives considered**:
- Apply override to all wave mutating operations: rejected as out of scope and riskier.

### 4. Owner-only freeze mode mutation

**Decision**: Only owners may set `freezeMode` (including returning to `AUTO`).

**Rationale**: Explicit freeze is a high-impact moderation control and should align with top wave authority.

**Alternatives considered**:
- Allow facilitator updates: rejected by product decision.

### 5. Visibility for facilitators via Wave API

**Decision**: Add explicit freeze mode field to Wave responses exposed through existing Wave queries so facilitators can see manual state.

**Rationale**: Facilitators need operational visibility even without write privileges.

**Alternatives considered**:
- Hide explicit freeze mode and expose only computed freeze: rejected because it masks whether freeze is manual or schedule-derived.

### 6. Keep computed frozen state for compatibility

**Decision**: Keep `isFrozen` as the effective freeze indicator used by clients and internal guards; extend its computation to include `freezeMode` precedence.

**Rationale**: Minimizes client breakage and preserves existing API expectations.

**Alternatives considered**:
- Replace `isFrozen` with a new field name: rejected due to unnecessary breaking change.

## Risks / Trade-offs

- [Behavioral drift between date state and effective state] -> Add explicit requirement language and centralized helper logic so all paths use one resolver.
- [Operator confusion when schedule says frozen but mode is UNFROZEN] -> Expose both explicit freeze mode and effective state in API documentation.
- [Missed enforcement path] -> Update all shared frozen-check helpers and SQL-based frozen checks used by comments/photos.
- [Migration defaults affecting legacy waves] -> Backfill `freezeMode='AUTO'` for all existing rows to preserve current behavior.
