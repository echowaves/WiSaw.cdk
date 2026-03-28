## Why

The AppSync GraphQL API is protected only by a single API key embedded in the mobile app. Bots and scrapers with the key can call any operation without restriction. Production logs show recurring automated callers sending malformed requests (~hourly), wasting Lambda invocations and cluttering CloudWatch. Adding AWS WAF with rate limiting provides a low-cost ($6-8/month) defense layer that blocks sustained automated abuse without affecting legitimate users.

## What Changes

- Add an AWS WAF Web ACL with a rate-based rule to the CDK stack
- Associate the Web ACL with the AppSync API
- Configure an IP-based rate limit (300 requests per 5 minutes per IP) that blocks IPs exceeding the threshold
- Deploy to both test and prod environments (same CDK stack, no environment gating)

## Capabilities

### New Capabilities

- `api-rate-limiting`: WAF Web ACL with rate-based rules attached to the AppSync API to throttle abusive callers by IP

### Modified Capabilities

(none)

## Impact

- **Code**: New CDK resource file for WAF (`lib/resources/waf.ts`), updates to `lib/resources/app-sync.ts` or `lib/wi_saw.cdk-stack.ts` for Web ACL association
- **Infrastructure**: New WAF Web ACL and rate-based rule deployed per environment
- **Cost**: ~$6-8/month per environment ($5 Web ACL + $1 rule + negligible request charges)
- **APIs**: No application-level changes — WAF operates transparently at the AWS edge
- **Dependencies**: No new npm packages — uses existing `aws-cdk-lib/aws_wafv2` constructs
