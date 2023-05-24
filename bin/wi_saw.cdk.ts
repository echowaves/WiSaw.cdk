#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import { WiSawCdkStack, deployEnv } from "../lib/wi_saw.cdk-stack"

const app = new cdk.App()
new WiSawCdkStack(app, deployEnv() + "-WiSawCdkStack", {
  env: {
    region: "us-east-1",
  },
})
