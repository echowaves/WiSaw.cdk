## Why

Codacy/Opengrep flags the regex in `assertValidUuid.ts` as a potential ReDoS vulnerability. While the current regex (`/^[0-9a-f]{8}-...$/i`) uses fixed-width quantifiers and is provably safe, eliminating the regex entirely removes the class of vulnerability and avoids false positive noise in static analysis.

## What Changes

- Replace the regex-based UUID validation in `assertValidUuid` with a structural character-by-character check (length, dash positions, hex character ranges via `charCodeAt`)
- No regex engine involvement — validation becomes a simple loop with O(1) bounded execution
- No behavioral change: same inputs pass, same inputs fail, same error messages

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `input-validation`: The `assertValidUuid` helper switches from regex to structural validation while preserving identical behavior

## Impact

- **Code**: `lambda-fns/utilities/assertValidUuid.ts` — single file change
- **APIs**: No change — same validation, same error messages
- **Dependencies**: No change
- **Static analysis**: Resolves Opengrep ReDoS false positive on this file
