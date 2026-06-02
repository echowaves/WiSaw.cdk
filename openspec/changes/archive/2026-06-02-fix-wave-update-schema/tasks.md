## 1. Update GraphQL Schema

- [x] 1.1 Add `open: Boolean`, `splashDate: String`, `freezeDate: String`, `freezeMode: String` parameters to `updateWave` mutation in `graphql/schema.graphql`

## 2. Verify

- [x] 2.1 Confirm `lambda-fns/index.ts` handler already passes these 4 parameters to the controller
- [x] 2.2 Confirm `lambda-fns/controllers/waves/update.ts` controller already accepts these 4 parameters
- [x] 2.3 Run `npm run build` (or equivalent) to verify no TypeScript errors
- [ ] 2.4 Deploy to a staging environment and test `updateWave` with `freezeDate` from the UI
