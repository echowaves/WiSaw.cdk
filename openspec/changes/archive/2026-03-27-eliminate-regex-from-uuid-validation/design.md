## Context

`assertValidUuid` in `lambda-fns/utilities/assertValidUuid.ts` currently uses a regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) to validate UUID format. Codacy's Opengrep flags any regex passed to `.test()` as a potential ReDoS vector. The regex is provably safe (fixed-width quantifiers, no backtracking ambiguity), but eliminating it entirely is cleaner than suppressing the warning.

## Goals / Non-Goals

**Goals:**
- Eliminate regex from UUID validation to remove the ReDoS warning class entirely
- Preserve identical validation behavior (same inputs accepted/rejected, same error messages)

**Non-Goals:**
- Changing the error message format or validation strictness
- Validating UUID version (v4 vs v1 etc.) — current validation accepts any UUID-shaped string
- Addressing other regex usage elsewhere in the codebase

## Decisions

### Decision: Structural character-by-character validation over regex

**Choice**: Validate by checking `length === 36`, dashes at positions 8/13/18/23, and hex chars (`charCodeAt` ranges) for all other positions.

**Alternatives considered**:
1. **Suppress the Opengrep warning** — quickest but leaves the tool noisy; new team members may waste time re-analyzing the same false positive
2. **Use `uuid` library's `validate()` function** — adds back the dependency we intentionally removed in the previous change; the library uses regex internally anyway

**Rationale**: A 36-character fixed-format string is trivially validated structurally. No regex engine, no dependencies, deterministic O(1) execution with zero backtracking risk.

## Risks / Trade-offs

- [Readability] The loop-based check is slightly less obvious than the regex at a glance → Mitigated by the function being small, self-contained, and named clearly
- [Maintenance] If UUID format requirements change (e.g., version-specific validation) the structural check needs manual updates → Acceptable since UUID format is a stable standard
