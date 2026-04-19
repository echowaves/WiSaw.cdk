## Why

CloudWatch Lambda Insights extension is attached to all standard Lambda functions, writing embedded metric format (EMF) data to each function's log group. Viewing the Lambda Insights dashboard triggers Logs Insights queries that scan this data, consuming the CloudWatch free tier `DataScanned-Bytes` quota (4.29 GB of 5 GB used in April 2026). The dashboards are not actively used for monitoring, making this an unnecessary cost driver.

## What Changes

- Remove the Lambda Insights layer (`LambdaInsightsVersion`) from all Lambda function definitions
- Remove the `insightsVersion` property from all `NodejsFunction` and `EdgeFunction` configurations
- Remove the Lambda Insights layer ARN constant and import

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `cdk-infrastructure`: Remove the Lambda Insights extension requirement from Lambda function configuration. The requirement that the main handler Lambda has "Lambda Insights layer attached" will be removed.

## Impact

- **Code**: `lib/resources/lambdas.ts` — remove ~5 lines (layer ARN, `insightsVersion` variable, and `insightsVersion` property from each Lambda)
- **IAM**: Lambda execution roles will no longer need the `CloudWatchLambdaInsightsExecutionRolePolicy` managed policy (CDK removes this automatically when `insightsVersion` is removed)
- **CloudWatch**: Lambda Insights metrics will stop being collected; the Insights dashboard will show no new data
- **Cost**: Eliminates ~4-5 GB/month of Logs Insights data scanning, keeping the account within CloudWatch free tier
- **Observability**: Standard CloudWatch Lambda metrics (duration, errors, invocations, memory) remain available. Custom trace logging (`TRACE_LOG_ENABLED`) is unaffected
