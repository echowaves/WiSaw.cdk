## Why

The existing WAF configuration only rate-limits by IP, which does not block requests from known malicious IP addresses or defend against common web exploits (SQLi, XSS, bad bots). AWS provides cost-effective managed rule groups that leverage continuously updated threat intelligence. Adding the IP Reputation List and Common Rule Set managed rule groups (~$2/month combined) provides broad protection without requiring custom rule maintenance.

## What Changes

- Add the **AWSManagedRulesAmazonIpReputationList** managed rule group to the Web ACL to block requests from IPs identified as bots, threat actors, or compromised hosts.
- Add the **AWSManagedRulesCommonRuleSet** managed rule group to the Web ACL to block common web exploits including SQL injection, cross-site scripting, and other OWASP Top 10 attack patterns.
- Managed rules evaluate before the existing rate-based rule (lower priority numbers).

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `api-rate-limiting`: Adding managed rule group requirements to the existing WAF Web ACL spec.

## Impact

- **Code**: `lib/resources/waf.ts` — two additional rule entries in the Web ACL rules array.
- **Cost**: ~$2/month additional ($1/month per managed rule group, plus per-request charges typically negligible at low traffic).
- **Risk**: Managed rules may block legitimate requests that match common attack signatures. Override action set to `none` (use rule group's default actions) so individual rules within the group can be overridden later if false positives arise.
