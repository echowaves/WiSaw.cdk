import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import { Construct } from 'constructs'
import { deployEnv } from '../utilities/config'

export function createWaf (scope: Construct, apiArn: string): void {
  const webAcl = new wafv2.CfnWebACL(
    scope,
    `${deployEnv()}-WiSaw-WebACL`,
    {
      name: `${deployEnv()}-cdk-wisaw-waf`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${deployEnv()}-cdk-wisaw-waf`,
        sampledRequestsEnabled: true
      },
      rules: [
        {
          name: `${deployEnv()}-rate-limit-per-ip`,
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${deployEnv()}-rate-limit-per-ip`,
            sampledRequestsEnabled: true
          },
          statement: {
            rateBasedStatement: {
              limit: 300,
              aggregateKeyType: 'IP'
            }
          }
        },
        {
          name: `${deployEnv()}-aws-ip-reputation-list`,
          priority: 10,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${deployEnv()}-aws-ip-reputation-list`,
            sampledRequestsEnabled: true
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList'
            }
          }
        },
        {
          name: `${deployEnv()}-aws-common-rule-set`,
          priority: 20,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${deployEnv()}-aws-common-rule-set`,
            sampledRequestsEnabled: true
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet'
            }
          }
        }
      ]
    }
  )

  new wafv2.CfnWebACLAssociation(
    scope,
    `${deployEnv()}-WiSaw-WebACL-Association`,
    {
      webAclArn: webAcl.attrArn,
      resourceArn: apiArn
    }
  )
}
