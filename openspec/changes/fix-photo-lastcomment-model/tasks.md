## 1. Add lastComment to Photo Model

- [x] 1.1 Add `lastComment: string | null` property to `lambda-fns/models/photo.ts` after `countryCode`

## 2. Verify

- [x] 2.1 Check TypeScript compilation (`npx tsc --noEmit`)
- [x] 2.2 Review `listWaves.ts` to confirm SQL query selects `lastComment` via `Photos.*`
- [x] 2.3 Review `feedForWave.ts` to confirm SQL query selects `lastComment` via `Photos.*`
