## 1. Trace Logging Utility

- [x] 1.1 Create `lambda-fns/utilities/trace.ts` with `traceLog(label, data?)` function and `traceWrap(label, fn)` async wrapper, both guarded by `process.env.TRACE_LOG_ENABLED === 'true'`

## 2. Database Layer Instrumentation

- [x] 2.1 Add trace logging around `query()` in `lambda-fns/psql.ts` — emit `psql.query:START` (with first 200 chars of query text) and `psql.query:END` (with duration and row count)
- [x] 2.2 Add trace logging around `connect()` and `clean()` in `lambda-fns/psql.ts` — emit `psql.connect:START/END` and `psql.clean:START/END` with duration

## 3. GraphQL Handler Instrumentation

- [x] 3.1 Add handler-level trace logging in `lambda-fns/index.ts` — emit `handler:START` with `fieldName` at entry and `handler:END` with `fieldName` and duration at exit

## 4. Standalone Lambda Instrumentation

- [x] 4.1 Add entry/exit trace logging to `lambda-fns/lambdas/processUploadedImage/index.ts`
- [x] 4.2 Add entry/exit trace logging to `lambda-fns/lambdas/processUploadedPrivateImage/index.ts`
- [x] 4.3 Add entry/exit trace logging to `lambda-fns/lambdas/processDeletedImage/index.ts`
- [x] 4.4 Add entry/exit trace logging to `lambda-fns/lambdas/processDeletedPrivateImage/index.ts`
- [x] 4.5 Add entry/exit trace logging to `lambda-fns/lambdas/generateSiteMap/index.ts`
- [x] 4.6 N/A — `lambda-fns/lambdas/getPhoto/` is empty (no handler file)
- [x] 4.7 Add entry/exit trace logging to `lambda-fns/lambdas/cleaupupAbuseReports/index.ts`
- [x] 4.8 N/A — `injectMetaTagsLambdaFunction` is a Lambda@Edge function (no env var support, no psql usage)
- [x] 4.9 N/A — `imgRedirectLambdaEdgeFunction` is a Lambda@Edge function (no env var support, no psql usage)
- [x] 4.10 N/A — `redirectLambdaEdgeFunction` is a Lambda@Edge function (no env var support, no psql usage)

## 5. Environment Configuration

- [x] 5.1 Add `TRACE_LOG_ENABLED` to `.env.sample` (default `false`) and CDK config so it is passed to all Lambda function environments
