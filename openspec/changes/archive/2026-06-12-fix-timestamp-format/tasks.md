## 1. Wave Controllers (11 files)

### 1.1 Standard timestamp replacements
- [x] 1.1.1 Replace `import moment from 'moment'` with `import dayjs, { type Dayjs } from 'dayjs'` in `createWaveInvite.ts`
- [x] 1.1.2 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `createWaveInvite.ts`
- [x] 1.1.3 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `create.ts`
- [x] 1.1.4 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `create.ts`
- [x] 1.1.5 Replace `moment().add(30, 'days').format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().add(30, 'days').toISOString()` in `create.ts`
- [x] 1.1.6 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `update.ts`
- [x] 1.1.7 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `update.ts`
- [x] 1.1.8 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `addPhoto.ts`
- [x] 1.1.9 Replace `moment().format('YYYY-MM-DD HH:mm:ss')` with `dayjs().toISOString()` in `addPhoto.ts` (no milliseconds format → full ISO)
- [x] 1.1.10 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `joinOpenWave.ts`
- [x] 1.1.11 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `joinOpenWave.ts`
- [x] 1.1.12 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `mergeWaves.ts`
- [x] 1.1.13 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `mergeWaves.ts`
- [x] 1.1.14 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `banUserFromWave.ts`
- [x] 1.1.15 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `banUserFromWave.ts`
- [x] 1.1.16 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `reportWavePhoto.ts`
- [x] 1.1.17 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `reportWavePhoto.ts`
- [x] 1.1.18 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `dismissWaveReport.ts`
- [x] 1.1.19 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `dismissWaveReport.ts`

### 1.2 Complex replacements (date arithmetic and types)
- [x] 1.2.1 Replace `import moment from 'moment'` with `import dayjs, { type Dayjs } from 'dayjs'` in `_seasonKey.ts`
- [x] 1.2.2 Replace `moment.Moment` type with `Dayjs` in `getSeasonKey(date: Dayjs): string`
- [x] 1.2.3 Replace `moment({ year: startYear, month: startMonth, day: 1 })` with `dayjs({ year: startYear, month: startMonth, day: 1 })` in `getSeasonBoundaries`
- [x] 1.2.4 Replace `.startOf('day').format('YYYY-MM-DD HH:mm:ss.SSS')` with `.startOf('day').toISOString()` in `getSeasonBoundaries`
- [x] 1.2.5 Replace `.endOf('month').format('YYYY-MM-DD HH:mm:ss.SSS')` with `.endOf('month').toISOString()` in `getSeasonBoundaries`
- [x] 1.2.6 Replace `import moment from 'moment'` with `import dayjs, { type Dayjs } from 'dayjs'` in `autoGroupPhotosIntoWaves.ts`
- [x] 1.2.7 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `autoGroupPhotosIntoWaves.ts`
- [x] 1.2.8 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `_updatePhotosCount.ts`
- [x] 1.2.9 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `_updatePhotosCount.ts`
- [x] 1.2.10 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `joinWaveByInvite.ts`
- [x] 1.2.11 Replace `moment().isAfter(moment(invite.expiresAt))` with `dayjs().isAfter(invite.expiresAt)` in `joinWaveByInvite.ts`
- [x] 1.2.12 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `joinWaveByInvite.ts`

### 1.3 Photo controllers
- [x] 1.3.1 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `photos/create.ts`
- [x] 1.3.2 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `photos/create.ts`
- [x] 1.3.3 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `photos/watch.ts`
- [x] 1.3.4 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `photos/watch.ts`
- [x] 1.3.5 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `photos/_notifyAllWatchers.ts`
- [x] 1.3.6 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `photos/_notifyAllWatchers.ts`
- [x] 1.3.7 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `photos/feedByDate.ts`
- [x] 1.3.8 Replace `moment.Moment` type with `Dayjs` in `_retrievePhotos(currentDate: Dayjs, ...)`
- [x] 1.3.9 Replace `moment()` with `dayjs()` and `moment(dateString)` with `dayjs(dateString)` in `feedByDate.ts`
- [x] 1.3.10 Replace `.clone().subtract().format('YYYY-MM-DD HH:mm:ss.SSS')` with `.clone().subtract().toISOString()` in `feedByDate.ts`
- [x] 1.3.11 Replace `.clone().add().subtract().format('YYYY-MM-DD HH:mm:ss.SSS')` with `.clone().add().subtract().toISOString()` in `feedByDate.ts`
- [x] 1.3.12 Update commented-out `moment().format("YYYY-MM-DD HH:mm:ss.SSS")` in `photos/delete.ts`

## 2. Other Controllers (8 files)

- [x] 2.1 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `abuseReports/create.ts`
- [x] 2.2 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `abuseReports/create.ts`
- [x] 2.3 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `secrets/register.ts`
- [x] 2.4 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `secrets/register.ts`
- [x] 2.5 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `secrets/update.ts`
- [x] 2.6 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `secrets/update.ts`
- [x] 2.7 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `contactForms/create.ts`
- [x] 2.8 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `contactForms/create.ts`
- [x] 2.9 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `friendships/createFriendship.ts`
- [x] 2.10 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `friendships/createFriendship.ts`
- [x] 2.11 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `comments/create.ts`
- [x] 2.12 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `comments/create.ts`
- [x] 2.13 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `comments/delete.ts`
- [x] 2.14 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `comments/delete.ts`
- [x] 2.15 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `comments/_updateCommentsCount.ts`
- [x] 2.16 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `comments/_updateCommentsCount.ts`
- [x] 2.17 Replace `import moment` with `import dayjs, { type Dayjs } from 'dayjs'` in `comments/_updateLastComment.ts`
- [x] 2.18 Replace `moment().format('YYYY-MM-DD HH:mm:ss.SSS')` with `dayjs().toISOString()` in `comments/_updateLastComment.ts`

## 3. Lambdas & Scripts (2 files)

- [x] 3.1 Replace `import moment from "moment"` with `import dayjs, { type Dayjs } from 'dayjs'` in `lambdas/processUploadedImage/index.ts`
- [x] 3.2 Replace all `moment().format("YYYY-MM-DD HH:mm:ss.SSS")` with `dayjs().toISOString()` in `lambdas/processUploadedImage/index.ts` (3 occurrences)
- [x] 3.3 Replace `require('moment')` with `const dayjs = require('dayjs')` in `scripts/populate-recognitions.js`
- [x] 3.4 Replace `moment().format("YYYY-MM-DD HH:mm:ss.SSS")` with `dayjs().toISOString()` in `scripts/populate-recognitions.js` (1 occurrence)

## 4. Spec File (1 file)

- [x] 4.1 Update `openspec/specs/controller-conventions/spec.md`: change timestamp convention from `moment().format("YYYY-MM-DD HH:mm:ss.SSS")` to `dayjs().toISOString()`
- [x] 4.2 Update the "Timestamp format reflects implementation usage" requirement to reference dayjs
- [x] 4.3 Update "Legacy timestamp exception path" scenario to remove legacy exception language (no more legacy exceptions)

## 5. Config (1 file)

- [x] 5.1 Replace `"moment": "2.30.1"` with `"dayjs": "1.11.11"` in `package.json`

## 6. Verification

- [x] 6.1 Run `grep -rn "moment()" lambda-fns/` to confirm zero remaining `moment()` calls in production code
- [x] 6.2 Run `grep -rn "require('moment')" scripts/` to confirm zero remaining moment requires in scripts
- [x] 6.3 Run `grep -rn "from 'moment'"` to confirm zero remaining ES module imports
- [x] 6.4 Run `tsc --noEmit` to verify no type errors
- [ ] 6.5 Run `npm test` (if available) to confirm no regressions
