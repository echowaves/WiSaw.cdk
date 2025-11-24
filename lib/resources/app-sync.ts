import * as cdk from 'aws-cdk-lib'
import * as appsync from 'aws-cdk-lib/aws-appsync'
import { Construct } from 'constructs'
import { deployEnv } from '../utilities/config'

export function createAppSyncApi (scope: Construct): appsync.GraphqlApi {
  // Create the AppSync API
  const api = new appsync.GraphqlApi(
    scope,
    `${deployEnv()}-WiSaw-appsyncApi-cdk`,
    {
      name: `${deployEnv()}-cdk-wisaw-appsync-api`,
      definition: {
        schema: appsync.SchemaFile.fromAsset('graphql/schema.graphql')
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365))
          }
        }
      },
      xrayEnabled: true
    }
  )
  return api
}
