## Context

The codebase has ~22 UUID validation throw sites across controllers using three inconsistent patterns:
1. `isValidPhotoId()` — custom regex in `lambda-fns/utilities/isValidPhotoId.ts`
2. `isValidDeviceUuid()` — identical regex in `lambda-fns/utilities/isValidDeviceUuid.ts`
3. `uuidValidate()` — from the `uuid` npm library

All three do the same thing (validate UUID format) but error messages vary: `"Wrong UUID format for photoId"`, `"Wrong UUID format"`, `"Wrong UUID format1"`. None include the actual invalid value.

## Goals / Non-Goals

**Goals:**
- Include the rejected value in every UUID validation error message for CloudWatch diagnostics
- Unify all three validators into a single `assertValidUuid` helper
- Standardize error message format: `Wrong UUID format for <fieldName>: "<value>"`
- Remove redundant utility files (`isValidPhotoId.ts`, `isValidDeviceUuid.ts`)

**Non-Goals:**
- Changing the UUID regex pattern itself
- Adding new validation to controllers that don't currently validate
- Fixing minified function names in stack traces (separate concern)
- Changing how AppSync surfaces errors to clients

## Decisions

### 1. Assert-style helper vs format-only helper

**Chosen**: `assertValidUuid(value, fieldName)` that validates and throws in one call.

**Alternative**: A `invalidUuidMessage(fieldName, value)` that only formats the string, keeping the `if/throw` at call sites.

**Rationale**: Every single existing call site uses the `if (!validate(x)) throw` pattern — none use the boolean return for branching. The assert style eliminates the if/throw boilerplate entirely and makes call sites single-line. It also prevents the mistake of checking but forgetting to throw.

### 2. Own regex vs `uuid` library validate

**Chosen**: Own regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).

**Rationale**: This is what `isValidPhotoId` and `isValidDeviceUuid` already use. It's a zero-dependency single line. The `uuid` library's `validate` function is slightly different (it also accepts non-standard formats in some versions). Using our own regex keeps behavior identical to the existing validators being replaced.

### 3. Remove old utilities vs keep as wrappers

**Chosen**: Remove `isValidPhotoId.ts` and `isValidDeviceUuid.ts` entirely.

**Rationale**: Neither is used as a boolean check anywhere — every call site immediately throws on failure. No external consumers. Keeping them as thin wrappers adds confusion about which to use.

## Risks / Trade-offs

- **Error message text change** → Any monitoring alerts that match on exact error message strings (e.g., `"Wrong UUID format for photoId"`) will still match since the prefix is preserved; only additional text (`: "<value>"`) is appended. Low risk.
- **Logging sensitive data** → The value logged is whatever was passed as a UUID argument. These are device identifiers or photo IDs, not secrets. No PII concern.
