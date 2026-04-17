## ADDED Requirements

### Requirement: Trace utility is opt-in by TRACE_LOG_ENABLED
`traceLog` emits `[TRACE]` logs only when `TRACE_LOG_ENABLED === 'true'`.

#### Scenario: Trace disabled by default
- **WHEN** env flag is absent or not equal to `'true'`
- **THEN** trace utility emits no logs

#### Scenario: Trace explicitly enabled
- **WHEN** env flag equals `'true'`
- **THEN** trace utility emits formatted trace lines

### Requirement: Handler start/end tracing covers dispatcher and standalone lambdas
GraphQL dispatcher and standalone lambda handlers emit START/END trace entries with durations when enabled.

#### Scenario: GraphQL handler tracing
- **WHEN** resolver invocation starts and ends
- **THEN** START and END logs include field context and duration

#### Scenario: Standalone lambda tracing
- **WHEN** scheduled or S3-triggered lambda executes
- **THEN** START and END logs include operation duration

### Requirement: psql connect/query/clean are traced
DB helper logs trace entries around connect/query/clean including query preview and row/duration metadata.

#### Scenario: Query tracing
- **WHEN** DB query runs with tracing enabled
- **THEN** trace logs include query preview and completion metadata

### Requirement: Trace env flag is provided through shared lambda config
Lambda environment receives trace flag through shared config spread used in CDK lambda definitions.

#### Scenario: Consistent env propagation across lambda set
- **WHEN** stack deploys lambda resources
- **THEN** trace flag is available from shared env configuration
