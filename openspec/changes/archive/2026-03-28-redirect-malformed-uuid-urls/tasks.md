## 1. Add malformed UUID redirect

- [x] 1.1 Add a new match case in `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js` after the existing integer ID redirect to detect URLs matching `/photos|videos/00000000-0000-0000-0000-{1-11 digits}` and 301 redirect to the correctly padded UUID, preserving query string

## 2. Verify

- [x] 2.1 Run `npx tsc --noEmit` and confirm clean compilation
