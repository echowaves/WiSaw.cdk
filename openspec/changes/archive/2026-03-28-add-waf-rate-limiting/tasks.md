## 1. Create WAF resource file

- [x] 1.1 Create `lib/resources/waf.ts` with a function that accepts the AppSync API ARN and creates a `CfnWebACL` (REGIONAL scope, default ALLOW) with a rate-based rule (300 requests per 5 minutes per IP, action BLOCK), and a `CfnWebACLAssociation` linking the Web ACL to the AppSync API ARN

## 2. Integrate into CDK stack

- [x] 2.1 Import and call the WAF function from `lib/wi_saw.cdk-stack.ts`, passing the AppSync API ARN after the API is created

## 3. Verify

- [x] 3.1 Run `npx tsc --noEmit` to confirm clean compilation
- [x] 3.2 Run `DEPLOY_ENV=test npx cdk synth` to confirm the CloudFormation template includes WAF resources
