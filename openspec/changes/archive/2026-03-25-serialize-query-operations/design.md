## Context

`ManagedServerlessClient` in `lambda-fns/psql.ts` wraps `serverless-postgres` (which wraps `pg.Client`). `pg.Client` is a single TCP connection using PostgreSQL's simple query protocol — one query in flight at a time. Seven controllers use `Promise.all` to fire concurrent queries through the singleton, and `clean()` internally runs its own queries (`_getProcessesCount`, `_getStrategy`, `_killProcesses`). Today pg@8 queues these internally but emits a deprecation warning; pg@9 removes this entirely.

The `ensureConnected()` method already deduplicates concurrent `client.connect()` calls via a shared `this.connecting` promise. But there is no equivalent serialization for `client.query()` calls.

## Goals / Non-Goals

**Goals:**
- Eliminate the `DeprecationWarning` from pg@8 about concurrent queries on a single client
- Make the singleton pg@9-safe without changing any controller code
- Serialize `connect()` health checks, `query()` calls, and `clean()` calls so only one operation touches `pg.Client` at a time

**Non-Goals:**
- Changing controller `Promise.all` patterns (they stay as-is)
- Adding a connection pool (pg.Pool or similar)
- Optimizing redundant health checks from concurrent `connect()` calls (4 sequential health checks at ~3ms each is acceptable)

## Decisions

### Promise-chain serialization (no explicit queue data structure)

Use a single `Promise` chain property (`operationChain`) to serialize operations. Each operation appends itself to the chain and awaits the result. This runs operations one at a time in order of arrival.

```typescript
private operationChain: Promise<unknown> = Promise.resolve()

private async serialized<T>(fn: () => Promise<T>): Promise<T> {
  const result = this.operationChain.then(fn, fn)
  this.operationChain = result.catch(() => {})
  return result
}
```

The `then(fn, fn)` pattern ensures `fn` runs regardless of whether the previous operation succeeded or failed. The `catch(() => {})` on the chain prevents unhandled rejection errors from propagating to subsequent chain links.

**Alternative considered**: Explicit queue with array + shift/push. Rejected — more code, more state, same behavior. The promise chain is idiomatic and zero-overhead.

**Alternative considered**: Serialize at controller level by removing `Promise.all`. Rejected — requires touching 7 controllers and `feedByDate` (15 parallel calls) would need significant restructuring.

### What gets serialized

| Method | Serialized portion | Left outside queue |
|---|---|---|
| `connect()` | `runHealthCheck(true)` — runs `SELECT 1` | `ensureConnected()` — already deduped via `this.connecting` |
| `query()` | `client.query()` + error-retry path (reconnect + health check + retry query) | `ensureConnected()` — already deduped |
| `clean()` | Entire `client.clean()` call (internally runs multiple queries) | N/A |

Key insight: `ensureConnected()` stays outside the queue because it uses `client.connect()` (not `client.query()`), and it already has its own deduplication. The queue only wraps calls that touch the query protocol.

### Error-retry stays inside the serialized block

When a query fails with a connection error, the retry logic (reconnect → health check → retry query) all executes within the same serialized call. This prevents other queued operations from hitting a dead connection while recovery is in progress.

### `restartClient()` resets the queue

When `restartClient()` creates a new `ServerlessClient` instance, the operation chain should be reset to `Promise.resolve()`. Any operations queued behind a failing operation will run their `fn` callback against the new client after the chain link resolves.

## Risks / Trade-offs

- [Sequential health checks on concurrent `connect()` calls] → Acceptable. 4 × ~3ms = ~12ms overhead. The `runHealthCheck` dedup via `pendingHealthCheck` partially mitigates this for non-forced checks, but `connect()` uses `force = true`. Future optimization possible but not needed now.
- [Increased latency for `feedByDate` with 15 parallel queries] → No change in practice. pg already serialized these internally. Moving serialization to application code adds negligible overhead (~0.1ms per promise resolution).
- [`clean()` blocks user queries while killing idle connections] → Same as today. `clean()` runs 1-3 internal queries (~14ms total per trace logs). Acceptable.
