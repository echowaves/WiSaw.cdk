import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as rds from '@aws-cdk/aws-rds';
import * as appsync from '@aws-cdk/aws-appsync';
import { ISecret, Secret } from "@aws-cdk/aws-secretsmanager";

export function deployEnv() {
  return process.env.DEPLOY_ENV || "test";
}


function envSpecific(logicalName: string | Function) {
  const suffix =
    typeof logicalName === "function"
    ? logicalName.name
    : logicalName;

  return `${deployEnv()}-${suffix}`;
}

export class WiSawCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct,  id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // Create the VPC needed for the Aurora Serverless DB instance
    const vpc = new ec2.Vpc(this, `${deployEnv()}-WiSaw-VPC-cdk`)

    // create RDS database
    const port = 5432
    const dbname = 'wisaw'
    const password = Secret.fromSecretCompleteArn(
      this,
      "BackendPersistencePassword",
      // Pass your password secret ARN
      "arn:aws:secretsmanager:us-east-1:963958500685:secret:prod/service/db/password-vFMQWh"
    ).secretValue

    const database = new rds.DatabaseInstance(this, `${deployEnv()}-WiSaw-Postgres-cdk`, {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_12_4,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcPlacement: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      storageType: rds.StorageType.GP2,
      allocatedStorage: 20,
      maxAllocatedStorage: 40,
      // monitoringInterval: 60,
      deletionProtection: deployEnv() === "prod", // should be conditional for prod
      instanceIdentifier: `${deployEnv()}-wisaw-db-cdk`,
      databaseName: dbname,
      port,
      credentials: {
        username: dbname,
        password,
      },
    })

    database.connections.allowFromAnyIpv4(ec2.Port.tcp(port))
    database.connections.allowDefaultPortInternally()


    // Create the AppSync API
    const api = new appsync.GraphqlApi(this, `${deployEnv()}-WiSaw-appsyncApi-cdk`, {
      name: `${deployEnv()}-cdk-wisaw-appsync-api`,
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

    // Create the Lambda function that will map GraphQL operations into Postgres
    const wisawFn = new lambda.Function(this, `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk`, {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: new lambda.AssetCode('lambda-fns'),
      handler: 'index.handler',
      memorySize: 1024,
      environment: {
        // DATABASE_ARN: database.arn,
        SECRET_ARN: database.secret?.secretArn || '',
        DB_NAME: dbname,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
      },
    });
    // Grant access to the database from the Lambda function
    database.grantConnect(wisawFn);
    // Set the new Lambda function as a data source for the AppSync API
    const lambdaDs = api.addLambdaDataSource('lambdaDatasource', wisawFn);

    // Map the resolvers to the Lambda function
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'listPhotos'
    });
    // lambdaDs.createResolver({
    //   typeName: 'Query',
    //   fieldName: 'getPhotoById'
    // });
    // lambdaDs.createResolver({
    //   typeName: 'Mutation',
    //   fieldName: 'createPhoto'
    // });
    // lambdaDs.createResolver({
    //   typeName: 'Mutation',
    //   fieldName: 'updatePhoto'
    // });
    // lambdaDs.createResolver({
    //   typeName: 'Mutation',
    //   fieldName: 'deletePhoto'
    // });

    // CFN Outputs
    new cdk.CfnOutput(this, 'AppSyncAPIURL', {
      value: api.graphqlUrl
    });
    new cdk.CfnOutput(this, 'AppSyncAPIKey', {
      value: api.apiKey || ''
    });
    new cdk.CfnOutput(this, 'ProjectRegion', {
      value: this.region
    });


  }
}
