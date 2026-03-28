## ADDED Requirements

### Requirement: IP Reputation List managed rule group
The Web ACL SHALL include the AWS managed rule group `AWSManagedRulesAmazonIpReputationList` (vendor: AWS). The rule group SHALL use `overrideAction: none` to apply the group's default actions. The rule SHALL have CloudWatch metrics enabled.

#### Scenario: Request from a known malicious IP is blocked
- **WHEN** a request originates from an IP address on the AWS IP reputation threat list
- **THEN** the request SHALL be blocked by the IP Reputation List rule group before reaching AppSync

#### Scenario: Request from a clean IP passes through
- **WHEN** a request originates from an IP address not on any AWS threat list
- **THEN** the IP Reputation List rule group SHALL not block the request

### Requirement: Common Rule Set managed rule group
The Web ACL SHALL include the AWS managed rule group `AWSManagedRulesCommonRuleSet` (vendor: AWS). The rule group SHALL use `overrideAction: none` to apply the group's default actions. The rule SHALL have CloudWatch metrics enabled.

#### Scenario: Request containing SQL injection pattern is blocked
- **WHEN** a request contains a SQL injection pattern in its body or query parameters
- **THEN** the request SHALL be blocked by the Common Rule Set rule group

#### Scenario: Request containing XSS pattern is blocked
- **WHEN** a request contains a cross-site scripting pattern in its body or query parameters
- **THEN** the request SHALL be blocked by the Common Rule Set rule group

#### Scenario: Normal GraphQL request passes through
- **WHEN** a request contains a valid GraphQL query without exploit patterns
- **THEN** the Common Rule Set rule group SHALL not block the request
