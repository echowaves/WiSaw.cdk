## 1. Fix infinite redirect loop

- [x] 1.1 Add a guard in the malformed ID redirect block in `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js`: after computing `uuid`, compare it to `id` — if they match, skip the redirect and let the request pass through

## 2. Verify

- [x] 2.1 Run `npx tsc --noEmit` and confirm clean compilation
