## 1. Replace regex with structural validation

- [x] 1.1 Replace the `UUID_REGEX` constant and `.test()` call in `lambda-fns/utilities/assertValidUuid.ts` with a `isValidUuidFormat` function that validates structurally: check `length === 36`, dashes at positions 8/13/18/23, hex chars (via `charCodeAt` ranges 48-57, 65-70, 97-102) at all other positions

## 2. Verify

- [x] 2.1 Run `npx tsc --noEmit` to confirm clean compilation
- [x] 2.2 Run Codacy CLI analysis on `assertValidUuid.ts` to confirm no ReDoS warning
