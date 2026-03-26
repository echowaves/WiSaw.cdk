## 1. Add serialization queue to ManagedServerlessClient

- [x] 1.1 Add `operationChain` property and `serialized<T>()` method to `ManagedServerlessClient`
- [x] 1.2 Wrap the health check portion of `connect()` with `serialized()`
- [x] 1.3 Wrap the query execution (and error-retry path) in `query()` with `serialized()`
- [x] 1.4 Wrap `client.clean()` call in `clean()` with `serialized()`
- [x] 1.5 Reset `operationChain` in `restartClient()`

## 2. Update spec

- [x] 2.1 Sync `database-access-patterns` spec in `openspec/specs/database-access-patterns/spec.md` with the delta spec changes
