## Background

All 27 controller files use `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` to generate timestamp strings. The GraphQL schema declares `AWSDateTime` for timestamps, which Apollo Client expects to be valid ISO 8601. The current format (`"2026-06-12 02:43:30.793"`) uses a space separator and has no timezone, making it invalid ISO 8601.

## Decisions

### Decision 1: Use `dayjs` instead of `new Date().toISOString()`

**Rationale**: Day.js is a drop-in replacement for moment.js — it uses the same API for all methods used in this codebase:
- `dayjs()` / `dayjs(date)` — date creation and parsing
- `dayjs().toISOString()` — ISO 8601 output
- `dayjs().add(n, 'unit')` — date arithmetic
- `dayjs().isAfter(date)` — date comparison
- `dayjs().clone().subtract()` — immutable date manipulation
- `dayjs({ year, month, day }).startOf('day').endOf('month')` — date boundaries

This approach means the code structure barely changes — we're swapping the library and the format method. Using `dayjs()` instead of raw `new Date()` avoids the risk of introducing subtle bugs in date arithmetic that was already working correctly with moment.

**Alternative considered**: Use `new Date().toISOString()` directly. This would remove the moment dependency entirely but requires rewriting date arithmetic patterns (`moment().add(30, 'days')`, `moment({ year, month, day }).startOf('day')`) to use native Date APIs, which is more error-prone.

### Decision 2: Import `Dayjs` type from `'dayjs'` root

```typescript
import dayjs, { type Dayjs } from 'dayjs'
```

This follows the Day.js recommended pattern for TypeScript. The type is available from the main export and works correctly for type annotations.

### Decision 3: Normalize all timestamps to full ISO 8601

One file (`waves/addPhoto.ts`) uses `moment().format('YYYY-MM-DD HH:mm:ss')` without milliseconds. We will replace this with `dayjs().toISOString()` to be consistent — all timestamps will have millisecond precision and the `Z` timezone suffix.

### Decision 4: Only update the main spec, not archived specs

The main spec (`openspec/specs/controller-conventions/spec.md`) documents the current convention. Archived specs in `openspec/changes/archive/` reflect historical states and should not be modified.

## Method Verification

All methods used across the codebase are verified compatible with Day.js core API (no plugins needed):

| Method | Usage Count | Day.js Support |
|--------|-------------|----------------|
| `dayjs()` / `dayjs(date)` | 20 | ✅ Core API |
| `dayjs().toISOString()` | 32 (target) | ✅ Core API |
| `dayjs().add(n, 'unit')` | 3 | ✅ Core API |
| `dayjs().isAfter(date)` | 1 | ✅ Core API |
| `dayjs().clone()` | 2 | ✅ Core API |
| `dayjs().subtract(n, 'unit')` | 1 | ✅ Core API |
| `dayjs({ year, month, day })` | 2 | ✅ Core API |
| `.startOf('day')` | 1 | ✅ Core API |
| `.endOf('month')` | 1 | ✅ Core API |
| `.month()` | 1 | ✅ Core API (0-indexed) |
| `.year()` | 1 | ✅ Core API |

## Risks

[Risk: Type annotation changes in `_seasonKey.ts` and `feedByDate.ts`] → Mitigation: These files use standard Day.js API methods (`.month()`, `.year()`, `.clone()`, `.subtract()`). The `Dayjs` type is fully compatible with the usage patterns.

[Risk: `dayjs({ year, month, day })` object creation] → Mitigation: Day.js supports object creation with `year`, `month` (0-indexed), and `day` properties — identical to moment.js.

[Risk: Spec files reference old moment.js convention] → Mitigation: Update `openspec/specs/controller-conventions/spec.md` as part of this change.

## Files Changed

**Controllers (23 files):**
- `lambda-fns/controllers/photos/create.ts`, `watch.ts`, `_notifyAllWatchers.ts`, `feedByDate.ts`, `delete.ts` (comment)
- `lambda-fns/controllers/waves/createWaveInvite.ts`, `create.ts`, `update.ts`, `addPhoto.ts`, `joinOpenWave.ts`, `mergeWaves.ts`, `banUserFromWave.ts`, `reportWavePhoto.ts`, `_updatePhotosCount.ts`, `autoGroupPhotosIntoWaves.ts`, `joinWaveByInvite.ts`, `dismissWaveReport.ts`, `_seasonKey.ts`
- `lambda-fns/controllers/comments/create.ts`, `delete.ts`, `_updateCommentsCount.ts`, `_updateLastComment.ts`
- `lambda-fns/controllers/abuseReports/create.ts`, `secrets/register.ts`, `secrets/update.ts`, `friendships/createFriendship.ts`, `contactForms/create.ts`

**Lambdas (1 file):**
- `lambda-fns/lambdas/processUploadedImage/index.ts` (3 occurrences)

**Scripts (1 file):**
- `scripts/populate-recognitions.js` (1 occurrence)

**Specs (1 file):**
- `openspec/specs/controller-conventions/spec.md`

**Config (1 file):**
- `package.json`

Total: **27 files, 32 timestamp sites**
