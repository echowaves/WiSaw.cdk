## 1. Update GraphQL Schema

- [x] 1.1 Add `splashDate: AWSDateTime` and `freezeDate: AWSDateTime` to `createWave` mutation in `graphql/schema.graphql`
- [x] 1.2 Change `splashDate: String` → `splashDate: AWSDateTime` in `updateWave` mutation
- [x] 1.3 Change `freezeDate: String` → `freezeDate: AWSDateTime` in `updateWave` mutation
- [x] 1.4 Change `freezeMode: String` → `freezeMode: WaveFreezeMode` in `updateWave` mutation
- [x] 1.5 Change return type `Boolean!` → `Wave!` for `createWave` mutation
- [x] 1.6 Change return type `Boolean!` → `Wave!` for `updateWave` mutation

## 2. Verify

- [x] 2.1 Confirm `lambda-fns/index.ts` handler already passes `splashDate` and `freezeDate` to `createWave` controller
- [x] 2.2 Confirm `lambda-fns/controllers/waves/create.ts` controller already accepts `splashDate` and `freezeDate`
- [x] 2.3 Run `npx tsc --noEmit` to verify no TypeScript errors
- [x] 2.4 Deploy to a staging environment and test `createWave`/`updateWave` with date/freeze-mode values from the UI
