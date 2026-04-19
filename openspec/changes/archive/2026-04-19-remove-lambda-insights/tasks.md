## 1. Remove Lambda Insights from CDK stack

- [x] 1.1 Remove the `layerArn` constant and `insightsVersion` variable from `lib/resources/lambdas.ts`
- [x] 1.2 Remove `insightsVersion` property from `wisawFn` (main GraphQL handler)
- [x] 1.3 Remove `insightsVersion` property from `processUploadedImageLambdaFunction`
- [x] 1.4 Remove `insightsVersion` property from `processDeletedImageLambdaFunction`
- [x] 1.5 Remove `insightsVersion` property from `cleanupAbuseReportsLambdaFunction`
- [x] 1.6 Remove `insightsVersion` property from `generateSiteMapLambdaFunction` (prod-only)

## 2. Verify

- [x] 2.1 Run `npx cdk synth` to confirm the stack synthesizes without errors
