import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as WiSawCdk from '../lib/wi_saw.cdk-stack';

const env = process.env.DEPLOY_ENV || "test"

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new WiSawCdk.WiSawCdkStack(app, `${env}-MyTestStack`);
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
