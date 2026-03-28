## 1. Broaden malformed UUID redirect

- [x] 1.1 Replace the existing `malformedUuidMatch` regex block in `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js` with a strip-and-test approach: extract the ID segment, strip all `0` and `-` characters, check if the remainder is a non-empty digits-only string, and if so 301 redirect to the correctly formatted UUID (preserving query string)

## 2. Verify

- [x] 2.1 Run `npx tsc --noEmit` and confirm clean compilation
