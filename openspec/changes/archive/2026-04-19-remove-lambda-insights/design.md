## Context

All standard Lambda functions in the CDK stack attach CloudWatch Lambda Insights via a shared `insightsVersion` variable referencing layer ARN `arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:14`. This layer injects an extension process into each Lambda invocation that collects enhanced metrics (CPU, memory, disk, network) and writes them as EMF logs. The Lambda Insights console dashboard queries these logs via Logs Insights, consuming the free tier `DataScanned-Bytes` quota.

The Insights dashboards are not used for operational monitoring. Standard CloudWatch Lambda metrics and the custom `[TRACE]` logging system cover current observability needs.

## Goals / Non-Goals

**Goals:**
- Remove Lambda Insights from all Lambda functions to eliminate unnecessary CloudWatch data scanning
- Stay within CloudWatch free tier limits

**Non-Goals:**
- Adding replacement monitoring or dashboards
- Changing log retention settings (already at 1 day)
- Modifying any Lambda behavior or configuration beyond Insights removal

## Decisions

### 1. Remove entirely rather than disable

**Decision**: Remove the `insightsVersion` property, layer ARN, and import rather than conditionally disabling.

**Alternatives considered**:
- *Environment-variable toggle*: Lambda Insights has no built-in disable switch; the extension either runs or doesn't based on the layer being attached. Would still incur cold-start overhead.
- *Remove only from non-prod*: Doesn't solve the problem since prod is the main data source.

**Rationale**: Complete removal is the simplest path. If Insights is needed again, re-adding the two lines is trivial.

### 2. Single deployment, no phased rollout

**Decision**: Remove from all functions in one deployment.

**Rationale**: This is a monitoring-only change with no impact on application behavior. No data migration, no API changes, no user-visible effects.

## Risks / Trade-offs

- **[Reduced visibility]** → Enhanced metrics (per-invocation CPU, memory, network) will no longer be collected. **Mitigation**: Standard CloudWatch metrics (Duration, Errors, Throttles, ConcurrentExecutions, IteratorAge) remain. These have been sufficient for day-to-day operations.
- **[Re-adding later]** → If enhanced metrics are needed for a future debugging session, the layer must be re-added and redeployed. **Mitigation**: Two-line change; can be deployed in minutes.
