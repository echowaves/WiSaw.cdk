## ADDED Requirements

### Requirement: Trace utility is opt-in by TRACE_LOG_ENABLED
`traceLog` emits `[TRACE]` logs only when `TRACE_LOG_ENABLED === 'true'`.

### Requirement: Handler start/end tracing covers dispatcher and standalone lambdas
GraphQL dispatcher and standalone lambda handlers emit START/END trace entries with durations when enabled.

### Requirement: psql connect/query/clean are traced
DB helper logs trace entries around connect/query/clean including query preview and row/duration metadata.

### Requirement: Trace env flag is provided through shared lambda config
Lambda environment receives trace flag through shared config spread used in CDK lambda definitions.
