## Why

UUID validation errors in production CloudWatch logs show generic messages like `"Wrong UUID format"` or `"Wrong UUID format1"` with no indication of what invalid value was actually received. This makes it impossible to diagnose whether the caller is sending integer IDs, empty strings, or garbage — information needed to trace the source of bad requests. The ~22 throw sites across the codebase also use three different inconsistent patterns (named field, numbered suffix, or no context at all).

## What Changes

- Create a shared `assertValidUuid(value, fieldName)` utility that validates UUID format and throws with a consistent message including both the field name and the rejected value: `Wrong UUID format for <field>: "<value>"`
- Replace all ~22 UUID validation throw sites across controllers to use the shared helper
- Remove `isValidPhotoId.ts` and `isValidDeviceUuid.ts` utilities (fully replaced by the shared helper)
- Remove `uuid` library `validate` imports from controllers that only used it for validation (keep imports where `v4`/other `uuid` exports are still used)

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `input-validation`: Consolidate three separate UUID validators (`isValidPhotoId`, `isValidDeviceUuid`, `uuidValidate`) into a single `assertValidUuid` helper with standardized error messages that include the rejected value

## Impact

- **Code**: ~20 controller files across photos, waves, messages, friendships, secrets, abuseReports, comments, contactForms
- **Utilities**: `lambda-fns/utilities/assertValidUuid.ts` (new), `isValidPhotoId.ts` and `isValidDeviceUuid.ts` (removed)
- **Dependencies**: `uuid` library import removed from files that only used `validate`; kept where `v4` is still used
- **APIs**: No GraphQL schema changes. Error message text changes (includes the bad value now) — purely server-side logging improvement
