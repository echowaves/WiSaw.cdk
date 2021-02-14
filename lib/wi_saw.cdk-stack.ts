import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as rds from '@aws-cdk/aws-rds';
import * as appsync from '@aws-cdk/aws-appsync';

export class WiSawCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // Create the VPC needed for the Aurora Serverless DB cluster
    const vpc = new ec2.Vpc(this, 'WiSawAppVPC')
    // Create the Serverless Aurora DB cluster; set the engine to Postgres
    // const cluster = new rds.DatabaseInstance(this, 'WiSawDataBase', {
    //   engine: rds.DatabaseInstanceEngine.POSTGRES,
    //   parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.postgresql10'),
    //   vpc,
    // })
    const cluster = new rds.ServerlessCluster(this, 'AuroraWiSawCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
      defaultDatabaseName: 'WiSawDB',
      vpc,
      // scaling: { autoPause: cdk.Duration.seconds(0) } // Optional. If not set, then instance will pause after 5 minutes
    });


    // Create the AppSync API
    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'cdk-wisaw-appsync-api',
      schema: appsync.Schema.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
       defaultAuthorization: {
         authorizationType: appsync.AuthorizationType.API_KEY,
         apiKeyConfig: {
           expires: cdk.Expiration.after(cdk.Duration.days(365))
         }
       },
      },
    })
  }
}
