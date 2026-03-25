## Context

The production Lambda (`prod-cdk-wisaw-fn`) is logging a `DeprecationWarning: Calling client.query() when the client is already executing a query`. The database layer uses a `ManagedServerlessClient` wrapper around `serverless-postgres` with 80 max connections, health checks, and automatic reconnection. Controllers follow a `connect → query → clean` pattern, and some perform multiple sequential or parallel queries. Without visibility into execution timing, it's impossible to determine whether overlapping queries come from concurrent invocations sharing a connection, a race condition in health-check vs. query timing, or a controller issuing queries without await.

There is already a `PG_CLIENT_DEBUG` env var controlling debug logging inside `psql.ts`. The existing `logDebug` pattern (guarded by `this.debugEnabled`) provides a precedent for conditional logging.

## Goals / Non-Goals

**Goals:**
- Provide entry/exit trace logs for every Lambda invocation (GraphQL resolver and standalone Lambdas) with timing information
- Provide trace logs around every `psql.query()` call, including the query text (or its prefix) and duration
- Make all trace logging conditional on a single `TRACE_LOG_ENABLED` environment variable
- Zero runtime overhead when disabled (simple boolean guard)
- Deployable per-environment without code changes (flip env var in CDK config)

**Non-Goals:**
- Fixing the deprecation warning itself (this change provides the data to diagnose it)
- Replacing or augmenting the existing `PG_CLIENT_DEBUG` mechanism (the new tracing is complementary)
- Adding structured logging frameworks (e.g., pino, winston) — use plain `console.log`
- Adding distributed tracing (X-Ray, OpenTelemetry)
- Tracing inside individual controller functions (only entry/exit of the handler and DB calls)

## Decisions

### 1. Single utility module `lambda-fns/utilities/trace.ts`

Create a small utility that exports `traceLog(label: string, data?: Record<string, unknown>)` and a `traceWrap(label, fn)` async wrapper. Both check `process.env.TRACE_LOG_ENABLED === 'true'` before emitting logs.

**Rationale**: Centralizes the guard logic, keeps instrumentation one-liners in call sites, and follows the existing `utilities/` directory convention. A dedicated module avoids polluting `psql.ts` with unrelated concerns.

### 2. Instrument at three layers

| Layer | What gets logged | How |
|-------|-----------------|-----|
| **Handler entry/exit** (`index.ts` + each standalone lambda) | `fieldName` / lambda name, start timestamp, end timestamp, duration ms | Wrap the handler body with `traceWrap` or manual start/end calls |
| **psql.query()** | Query text (first 200 chars), start, end, duration, row count | Add tracing inside `ManagedServerlessClient.query()` |
| **psql.connect() / clean()** | Connection lifecycle | Add tracing inside existing methods |

**Rationale**: These three layers cover the full request path. If queries overlap, the trace logs will show a `query START` before the previous `query END`, pinpointing the problem.

### 3. Use `console.log` with a `[TRACE]` prefix

Output format: `[TRACE] <label> | <key=value pairs>`

Example:
```
[TRACE] handler:START | fieldName=feedByDate requestId=abc-123
[TRACE] psql.query:START | query=SELECT "Photos".* FROM "Photos" WHERE...
[TRACE] psql.query:END | duration=45ms rows=20
[TRACE] handler:END | fieldName=feedByDate duration=52ms
```

**Rationale**: Plain `console.log` is zero-dependency and CloudWatch-friendly. The `[TRACE]` prefix makes it easy to filter in CloudWatch Insights. Structured JSON is overkill for a diagnostic tool.

### 4. Environment variable: `TRACE_LOG_ENABLED`

- Value `'true'` enables tracing; anything else (or absent) disables it
- Added to the CDK config object that gets spread into all Lambda `environment` maps
- Added to `.env.sample` / `.env.*` files with default value `false`

**Rationale**: Follows the existing pattern of `PG_CLIENT_DEBUG`. Single env var for all tracing because the goal is to correlate handler and query timing in the same invocation.

### 5. Query text truncation

Log only the first 200 characters of query text to avoid bloating CloudWatch logs with large INSERT payloads.

**Rationale**: Enough to identify which query is running; sensitive data in parameters is not logged (parameterized queries pass values separately).

## Risks / Trade-offs

- **[Log volume]** → When enabled, each invocation will produce 2+ extra log lines (handler) plus 2 per query. For high-traffic resolvers this could increase CloudWatch costs. **Mitigation**: Off by default; only enable temporarily for diagnosis.
- **[Performance overhead when enabled]** → `Date.now()` calls and string formatting add microseconds per query. **Mitigation**: Negligible compared to network round-trip times. Guard check when disabled is a single boolean comparison.
- **[Query text in logs]** → Truncated to 200 chars and parameters are not logged, but raw SQL from non-parameterized queries could contain IDs. **Mitigation**: Acceptable for a diagnostic tool; disable after use.
