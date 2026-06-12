## Why

Controllers generate timestamps using `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` which produces non-ISO 8601 strings like `"2026-06-12 02:43:30.793"` (space separator, no timezone). GraphQL schemas declare `AWSDateTime` fields which Apollo Client expects to be valid ISO 8601 (`"2026-06-12T02:43:30.793Z"`). This format mismatch causes Apollo Client to reject the timestamps, breaking the UI.

The fix requires two changes:
1. Replace `moment` with `dayjs` (a lightweight, drop-in compatible alternative)
2. Use `.toISOString()` instead of `.format('YYYY-MM-DD HH:mm:ss.SSS')` to produce valid ISO 8601 strings

## What Changes

- Replace `import moment from 'moment'` with `import dayjs, { type Dayjs } from 'dayjs'` in all files
- Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()`
- Replace `moment().add(30, 'days').format(...)` with `dayjs().add(30, 'days').toISOString()`
- Replace `moment().isAfter(moment(date))` with `dayjs().isAfter(date)`
- Replace `moment.Moment` type annotations with `Dayjs` type
- Replace `"moment": "2.30.1"` with `"dayjs": "1.11.11"` in package.json
- Update `openspec/specs/controller-conventions/spec.md` to reflect new convention
- Update commented-out code in `photos/delete.ts` for consistency

## Capabilities

### New Capabilities
_None_

### Modified Capabilities

- `controller-conventions`: Timestamp generation convention changes from `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` to `dayjs().toISOString()`

## Impact

- **27 source files** across `lambda-fns/controllers/`, `lambda-fns/lambdas/`, and `scripts/`
- **32 timestamp generation sites** replaced with `dayjs().toISOString()`
- **18 import statements** replaced (`moment` → `dayjs`)
- **2 type annotations** updated (`moment.Moment` → `Dayjs`)
- **1 spec file** updated (`openspec/specs/controller-conventions/spec.md`)
- **1 dependency** replaced (`moment` → `dayjs`)
- **No behavior changes**: Day.js is a drop-in replacement for all methods used (`format`, `add`, `isAfter`, `clone`, `subtract`, `startOf`, `endOf`, object creation, `.month()`, `.year()`)
