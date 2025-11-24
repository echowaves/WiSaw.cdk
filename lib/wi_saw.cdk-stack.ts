import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { config, deployEnv } from './utilities/config'
import { createDatabase } from './resources/database'
import { createAppSyncApi } from './resources/app-sync'
import { createLambdas } from './resources/lambdas'
import { createBuckets } from './resources/buckets'
import { createCloudFront } from './resources/cloud-front'
import { createResolvers } from './resources/resolvers'

export { deployEnv }

export class WiSawCdkStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    const database = createDatabase(this, config)

    const api = createAppSyncApi(this)

    const lambdas = createLambdas(this, config)
    const { wisawFn } = lambdas

    const buckets = createBuckets(this, lambdas)

    createCloudFront(this, buckets, lambdas)

    // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Grant access to the database from the Lambda function
    database.grantConnect(wisawFn, config.username)

    // Set the new Lambda function as a data source for the AppSync API
    const lambdaDs = api.addLambdaDataSource('lambdaDatasource', wisawFn)

    // Map the resolvers to the Lambda function
    createResolvers(this, api, lambdaDs)

    // CFN Outputs
    // eslint-disable-next-line no-new
    new cdk.CfnOutput(this, 'AppSyncAPIURL', {
      value: api.graphqlUrl
    })
    // eslint-disable-next-line no-new
    new cdk.CfnOutput(this, 'AppSyncAPIKey', {
      value: api.apiKey ?? ''
    })
    // eslint-disable-next-line no-new
    new cdk.CfnOutput(this, 'ProjectRegion', {
      value: this.region
    })
  }
}