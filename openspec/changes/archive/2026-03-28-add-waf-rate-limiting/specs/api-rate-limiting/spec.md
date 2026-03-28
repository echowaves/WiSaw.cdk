## ADDED Requirements

### Requirement: WAF Web ACL attached to AppSync API
The CDK stack SHALL create an AWS WAFv2 Web ACL and associate it with the AppSync GraphQL API. The Web ACL SHALL use REGIONAL scope.

#### Scenario: Web ACL is deployed with the stack
- **WHEN** the CDK stack is deployed
- **THEN** a WAFv2 Web ACL SHALL be created and associated with the AppSync API ARN

#### Scenario: Web ACL deploys to both environments
- **WHEN** the stack is deployed with `DEPLOY_ENV=test` or `DEPLOY_ENV=prod`
- **THEN** the Web ACL SHALL be created in that environment with an environment-prefixed name

### Requirement: IP-based rate limiting rule
The Web ACL SHALL contain a rate-based rule that limits requests per source IP address. The rate limit SHALL be 300 requests per 5-minute evaluation window. When an IP exceeds the limit, subsequent requests from that IP SHALL be blocked until the rate drops below the threshold.

#### Scenario: Normal traffic passes through
- **WHEN** a client IP sends fewer than 300 requests in a 5-minute window
- **THEN** all requests SHALL be allowed through to AppSync

#### Scenario: Excessive traffic is blocked
- **WHEN** a client IP sends more than 300 requests in a 5-minute window
- **THEN** requests from that IP SHALL be blocked by WAF until the rate drops below the threshold

#### Scenario: Rate limit is per-IP
- **WHEN** two different IPs each send 250 requests in a 5-minute window
- **THEN** both IPs SHALL be allowed through (each is under the 300 threshold individually)

### Requirement: Default action allows unmatched requests
The Web ACL's default action SHALL be ALLOW. Only requests explicitly matching a block rule SHALL be blocked.

#### Scenario: Requests not matching any rule
- **WHEN** a request does not match any WAF rule
- **THEN** it SHALL be allowed through to AppSync
