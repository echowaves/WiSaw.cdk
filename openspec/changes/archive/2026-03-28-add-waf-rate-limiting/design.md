## Context

The AppSync API uses API_KEY auth (single key, 365-day TTL, embedded in the mobile app). There is no rate limiting or bot mitigation. Production logs show automated callers sending malformed photoId values ~hourly. The CDK stack deploys to both test and prod environments via `DEPLOY_ENV`.

The stack creates the AppSync API in `lib/resources/app-sync.ts` and wires it up in `lib/wi_saw.cdk-stack.ts`. WAF Web ACL association with AppSync is done via a `CfnWebACLAssociation` referencing the AppSync API ARN.

## Goals / Non-Goals

**Goals:**
- Rate-limit requests per IP to block sustained automated abuse
- Deploy WAF to both environments via existing CDK stack
- Keep the implementation minimal — one rate-based rule

**Non-Goals:**
- Geo-blocking or country-level restrictions
- Bot Control managed rule group (cost disproportionate to threat)
- User-level or API-key-level rate limiting (would require Cognito)
- WAF logging to S3/CloudWatch (can be added later if needed)
- Changing the API authentication model

## Decisions

### Decision: Use L1 CfnWebACL construct

**Choice**: Use `aws_wafv2.CfnWebACL` and `CfnWebACLAssociation` (L1 CloudFormation constructs).

**Alternatives considered**:
1. **L2 construct** — CDK does not have a stable L2 WAF construct as of aws-cdk-lib 2.x
2. **Third-party CDK construct** — adds an external dependency; the L1 constructs are straightforward for a single rule

**Rationale**: L1 is the only option in aws-cdk-lib for WAFv2. The configuration is simple enough that L1 verbosity is manageable.

### Decision: Rate limit of 300 requests per 5-minute window

**Choice**: 300 requests per 5 minutes per IP, action BLOCK.

**Rationale**: A user scrolling through the photo feed might make 20-30 requests/minute in bursts. 300 per 5 minutes (60/min sustained) provides headroom for legitimate use while blocking automated crawling. AWS WAF evaluates rate-based rules over a trailing 5-minute window — this is the evaluation period, not configurable.

### Decision: Separate resource file, pass API ARN

**Choice**: Create `lib/resources/waf.ts` that exports a function accepting the AppSync API ARN, creating the Web ACL and association. Called from the main stack.

**Rationale**: Follows the existing pattern (`app-sync.ts`, `database.ts`, `lambdas.ts`, etc.) of one resource file per concern.

### Decision: REGIONAL scope

**Choice**: Web ACL scope is `REGIONAL` (not `CLOUDFRONT`).

**Rationale**: AppSync APIs are regional resources. WAF for AppSync must use REGIONAL scope. CLOUDFRONT scope is only for CloudFront distributions.

## Risks / Trade-offs

- [Shared IP blocking] Users behind the same NAT/VPN could be collectively rate-limited → 300/5min threshold is generous enough to make this unlikely for legitimate users
- [No visibility into blocked requests] Without WAF logging, blocked requests are silent → Can add CloudWatch metrics on the WebACL's `BlockedRequests` metric as a follow-up
- [CDK drift] L1 constructs don't benefit from CDK abstractions → Acceptable for a stable, simple configuration

## Migration Plan

1. Deploy to test: `DEPLOY_ENV=test npx cdk deploy` — verify WAF resources created, API still functional
2. Deploy to prod: `DEPLOY_ENV=prod npx cdk deploy`
3. Rollback: Remove WAF resource file and stack references, redeploy — AppSync continues without WAF
