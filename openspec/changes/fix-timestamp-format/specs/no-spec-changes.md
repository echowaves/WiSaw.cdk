## No Spec Changes

This change does **not** modify any spec-level requirements. The `controller-conventions` spec describes implementation conventions (how timestamps are generated), not system behavior. Changing from `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` to `dayjs().toISOString()` does not alter what the system does — only how it does it.

The convention documentation in `openspec/specs/controller-conventions/spec.md` is updated as part of the code change tasks, not as a spec delta file.
