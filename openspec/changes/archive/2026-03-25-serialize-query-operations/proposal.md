## Why

`pg.Client` is a single TCP connection that cannot multiplex queries. Seven controllers use `Promise.all` to fire 2-15 concurrent queries on the singleton `ManagedServerlessClient`, which all hit the same `pg.Client`. pg@8 queues these internally but emits a `DeprecationWarning`; pg@9 will remove this behavior entirely, breaking all parallel query patterns. Additionally, `serverless-postgres`'s `clean()` method runs its own queries (process count, strategy, kill) on the same client, racing with user queries.

## What Changes

- Add an operation serialization queue to `ManagedServerlessClient` that ensures only one operation touches `pg.Client` at a time
- Wrap `connect()` (health check portion), `query()`, and `clean()` through the queue
- Controllers keep their existing `Promise.all` patterns unchanged — the queue serializes under the hood
- Zero new dependencies; ~10 lines of queue mechanism

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `database-access-patterns`: Add requirement that `ManagedServerlessClient` SHALL serialize all operations that touch `pg.Client`, ensuring concurrent callers are queued and executed one at a time

## Impact

- **Code**: `lambda-fns/psql.ts` — add serialization queue to `ManagedServerlessClient`
- **Controllers**: No changes required (7 controllers with `Promise.all` continue to work as-is)
- **Risk**: Minimal — same effective behavior as today (pg already queues internally), just makes it explicit and pg@9-safe
- **Performance**: Negligible — queries already serialize on the TCP connection; this moves serialization from pg internals to application code
