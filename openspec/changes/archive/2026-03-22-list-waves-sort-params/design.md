## Context

`listWaves` currently hardcodes `ORDER BY "Waves"."updatedAt" DESC`. The sort column and direction are not parameterizable in SQL (`$1` syntax), so they must be interpolated into the query string. This requires strict input validation to prevent SQL injection.

## Goals / Non-Goals

**Goals:**
- Allow clients to sort the wave list by `createdAt` or `updatedAt`, ascending or descending
- Maintain backward compatibility — omitting the new params yields current behavior
- Prevent SQL injection via whitelist validation of sort inputs

**Non-Goals:**
- Adding sort to other queries (`feedForWave`, etc.)
- Supporting sort by arbitrary columns (e.g. `name`, `photosCount`)
- Using GraphQL enums — keeping `String` type consistent with codebase conventions

## Decisions

### 1. Whitelist map for SQL fragment construction
**Decision:** Use a lookup object mapping allowed input strings to their quoted SQL equivalents. Reject any input not in the whitelist.

```
ALLOWED_SORT_FIELDS: { createdAt → '"createdAt"', updatedAt → '"updatedAt"' }
ALLOWED_DIRECTIONS: { asc → 'ASC', desc → 'DESC' }
```

**Rationale:** Column names and ASC/DESC can't use parameterized queries. A whitelist is the standard defense against SQL injection for ORDER BY clauses. The map also handles quoting.

### 2. String type, not GraphQL enum
**Decision:** Use `String` for both parameters in the GraphQL schema.

**Rationale:** The existing schema uses no enums. Keeping `String` is consistent. Validation happens server-side in the controller.

### 3. Default values applied in controller, not schema
**Decision:** Apply defaults (`updatedAt`, `desc`) in the controller when params are null/undefined.

**Rationale:** AppSync doesn't support GraphQL default values in the schema definition. Applying defaults in the controller is the established pattern.

## Risks / Trade-offs

- **[Minimal risk]** Only one controller changes. Defaults preserve existing behavior.
- **[Extensibility]** Adding more sort fields later just means adding entries to the whitelist map.
