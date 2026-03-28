## Context

The WiSaw AppSync API is protected by a WAFv2 Web ACL (`lib/resources/waf.ts`) that currently contains a single rate-based rule limiting each IP to 300 requests per 5-minute window. This blocks volumetric abuse but does not detect requests from known malicious IPs or common web exploit patterns. Production CloudWatch logs show automated callers sending malformed requests, indicating bot activity.

AWS provides managed rule groups maintained by the AWS Threat Research Team that are continuously updated with current threat intelligence. Two groups provide broad coverage at low cost: the IP Reputation List and the Common Rule Set.

## Goals / Non-Goals

**Goals:**
- Block requests from IPs on AWS threat intelligence lists (botnets, command-and-control, known attackers)
- Block requests matching common web exploit signatures (SQLi, XSS, path traversal, etc.)
- Achieve this with minimal code changes and no custom rule maintenance

**Non-Goals:**
- Advanced bot detection (AWS Bot Control at $10+/month — can be added later)
- Custom rule authoring for application-specific attack patterns
- Modifying the existing rate-based rule configuration

## Decisions

### Use `overrideAction: { none: {} }` for managed rule groups

Managed rule groups define their own actions (BLOCK/COUNT) per rule. Using `overrideAction: { none: {} }` passes through the group's default actions. This is the standard approach for managed rules and differs from custom rules which use `action`.

**Alternative**: `overrideAction: { count: {} }` — would log matches without blocking. Useful for initial testing but delays protection. We can switch individual rules within the group to COUNT later if false positives appear.

### Assign managed rules lower priority numbers than rate-based rule

Priority 10 for IP Reputation List, priority 20 for Common Rule Set, existing rate-based rule at priority 1. WAF evaluates rules in priority order (lowest first). However, since the rate-based rule uses `action: { block: {} }` and managed rules use `overrideAction`, the evaluation order between them is not critical — each applies independently. The priority assignment is for clarity and future extensibility.

**Correction**: Actually, WAF evaluates all rules regardless, but stops at the first matching BLOCK. Setting managed rules at higher priority numbers (evaluated after rate-based) is fine since rate-limited IPs should be blocked regardless. Setting managed rules at 10/20 and rate-limit at 1 means rate-limit evaluates first, which is efficient since it catches volumetric attacks cheaply before the managed rules (which have per-request costs) evaluate.

### Keep rate-based rule at priority 1

The rate-based rule at priority 1 evaluates first. If an IP is rate-limited, the request is blocked before reaching managed rules. This avoids per-request charges on the managed rule groups for already-blocked requests.

## Risks / Trade-offs

- **False positives from Common Rule Set** → Monitor WAF logs/metrics. Individual rules within the group can be overridden to COUNT mode via `excludedRules` if needed.
- **Cost increase** → ~$2/month fixed + negligible per-request fees at current traffic levels.
- **No rollback mechanism in CDK** → To disable a rule group, either remove it from the stack or change its `overrideAction` to `{ count: {} }` and redeploy.
