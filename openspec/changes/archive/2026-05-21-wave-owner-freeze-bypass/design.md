## Context

Wave owners currently cannot add photos, update wave details, or merge waves when their wave is frozen (date-based or mode-based). The `removePhoto` controller already correctly allows owners to bypass freeze restrictions. This inconsistency means owners lose control of their own waves at the moment they become most valuable — after a trip or event has concluded and the wave freezes automatically.

## Goals / Non-Goals

**Goals:**
- Wave owners can add photos to frozen waves (matching `removePhoto` behavior)
- Wave owners can update any field on frozen waves, including freezeDate and other properties
- Wave owners can merge frozen waves when they own both source and target

**Non-Goals:**
- No changes to non-owner role permissions (facilitators/contributors remain blocked by freeze)
- No changes to the freeze mechanism itself (date rules or freezeMode logic)
- No API/schema changes — behavior change only within existing controllers

## Decisions

1. **Use role-based bypass pattern** — Follow the existing `removePhoto` pattern: check user role first, then apply freeze restrictions only to non-owners. This is consistent with the codebase and requires minimal new logic.

2. **Remove date-freeze restriction from update entirely** — Since only owners can call `updateWave`, there's no need for a "freezeDate-only" exception path when the owner should be able to change anything.

3. **Remove freeze checks from mergeWaves** — Both waves must be owned by the same user (line 27-28 of mergeWaves.ts), so freezing is irrelevant — an owner can unfreeze their own wave at any time via `updateWave`.

## Risks / Trade-offs

[Risk: Owners could modify freezeDate to extend a frozen wave indefinitely] → Mitigation: This is the intended behavior — owners should control their wave's lifecycle.
[Risk: Merging frozen waves could surface stale data] → Mitigation: The merge operation updates `updatedAt` and recalculates photosCount, so the result is current.
