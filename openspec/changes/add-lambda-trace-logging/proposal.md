## Why

A `DeprecationWarning: Calling client.query() when the client is already executing a query` is appearing in production Lambda logs (pg driver). The root cause is unclear — it could be overlapping queries within a single invocation, concurrent Lambda invocations sharing a connection, or a race condition in the `ManagedServerlessClient` wrapper. To diagnose the issue, we need visibility into when each Lambda handler and controller function starts and ends execution, and which queries are in flight, so we can correlate the warning with specific call patterns.

## What Changes

- Add a **trace logging utility** that logs function entry/exit with timing, controlled by an environment variable (e.g., `TRACE_LOG_ENABLED`)
- **Instrument the main GraphQL Lambda handler** (`lambda-fns/index.ts`) to trace each resolver invocation (fieldName, start, end, duration)
- **Instrument all standalone Lambda handlers** (processUploadedImage, generateSiteMap, getPhoto, etc.) with entry/exit trace logs
- **Instrument `psql.ts`** to trace every `query()` and `connect()`/`clean()` call, including query text and timing — making it easier to spot overlapping queries
- **Add the `TRACE_LOG_ENABLED` env var** to the CDK stack so it flows to all Lambda functions and can be toggled per environment without a code change

## Capabilities

### New Capabilities
- `lambda-trace-logging`: Conditional trace logging for Lambda handler entry/exit, controller execution, and database query timing, controlled by an environment variable

### Modified Capabilities

## Impact

- **Code**: `lambda-fns/psql.ts`, `lambda-fns/index.ts`, all standalone lambda handlers under `lambda-fns/lambdas/`, CDK resource definitions in `lib/resources/`
- **Configuration**: New `TRACE_LOG_ENABLED` environment variable added to `.env.*` files and CDK Lambda environment config
- **Runtime**: When enabled, additional `console.log` output per invocation; when disabled, zero overhead (guard check only)
- **Dependencies**: None — uses built-in `console.log`
