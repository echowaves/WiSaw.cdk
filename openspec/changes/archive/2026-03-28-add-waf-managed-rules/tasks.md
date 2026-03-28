## 1. Add managed rule groups to WAF

- [x] 1.1 Add AWSManagedRulesAmazonIpReputationList rule group to the Web ACL rules array in `lib/resources/waf.ts` with priority 10 and `overrideAction: { none: {} }`
- [x] 1.2 Add AWSManagedRulesCommonRuleSet rule group to the Web ACL rules array in `lib/resources/waf.ts` with priority 20 and `overrideAction: { none: {} }`

## 2. Verify

- [x] 2.1 Run `npm run build` and confirm clean compilation
