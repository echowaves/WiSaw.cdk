import * as cdk from '@aws-cdk/core';
import * as s3 from "@aws-cdk/aws-s3";
import * as s3n from '@aws-cdk/aws-s3-notifications';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as rds from '@aws-cdk/aws-rds';
import * as appsync from '@aws-cdk/aws-appsync';
import * as iam from '@aws-cdk/aws-iam';
import { ISecret, Secret } from "@aws-cdk/aws-secretsmanager";
import * as path from 'path';



export function deployEnv() {
  return process.env.DEPLOY_ENV || "test";
}

const config = require(`../.env.${deployEnv()}`).config()

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
    // const vpc = new ec2.Vpc(this, `${deployEnv()}-WiSaw-VPC-cdk`)

    // create RDS database

    // const database = new rds.DatabaseInstance(this, `${deployEnv()}-WiSaw-Postgres-cdk`, {
    //   engine: rds.DatabaseInstanceEngine.postgres({
    //     version: rds.PostgresEngineVersion.VER_12_4,
    //   }),
    //   instanceType: ec2.InstanceType.of(
    //     ec2.InstanceClass.T3,
    //     ec2.InstanceSize.MICRO
    //   ),
    //   vpc,
    //   vpcPlacement: {
    //     subnetType: ec2.SubnetType.PUBLIC,
    //   },
    //   storageType: rds.StorageType.GP2,
    //   allocatedStorage: 20,
    //   maxAllocatedStorage: 40,
    //   // monitoringInterval: 60,
    //   deletionProtection: deployEnv() === "prod", // should be conditional for prod
    //   instanceIdentifier: `${deployEnv()}-wisaw-db-cdk`,
    //   databaseName: config.DB_DATABASE,
    //   port: config.DB_PORT,
    //   credentials: {
    //     username: config.DB_USERNAME,
    //     password: config.DB_PASSWORD,
    //   },
    // })

    // will refer to already created DB instance instead of creating new one.
    const database = rds.DatabaseInstance.fromDatabaseInstanceAttributes(this, `wisaw-${deployEnv()}`, {
          instanceIdentifier: `wisaw-${deployEnv()}`,
          instanceEndpointAddress: `wisaw-${deployEnv()}.cbaw0b5dcxjh.us-east-1.rds.amazonaws.com`,
          port: 5432,
          securityGroups: [],
    });

    database.connections.allowFromAnyIpv4(ec2.Port.tcp(parseInt(config.port)))
    database.connections.allowDefaultPortInternally()


    // Create the AppSync API
    const api = new appsync.GraphqlApi(this, `${deployEnv()}-WiSaw-appsyncApi-cdk`,
    {
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
    const wisawFn = new lambda.Function(this,
      `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk`,
        {
          runtime: lambda.Runtime.NODEJS_14_X,
          code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
          // code: new lambda.AssetCode('lambda-fns'),
          handler: 'index.handler',
          // memorySize: 10240,
          memorySize: 3008,
          timeout: cdk.Duration.seconds(30),
          environment: {
            ...config
          },
        }
      );


    // define lambda for thumbnails processing
        const processUploadedImageLambdaFunction =
          new lambda.Function(
            this,
            `${deployEnv()}_processUploadedImage`,
              {
                runtime: lambda.Runtime.NODEJS_14_X,
                code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
                // code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda-fns/controllers/photos')),
                handler: 'lambdas/processUploadedImage.main',
                memorySize: 3008,
                timeout: cdk.Duration.seconds(30),
                environment: {
                  ...config
                },
              }
            )
    // define lambda for thumbnails deletion processing
        const processDeletedImageLambdaFunction =
          new lambda.Function(
            this,
            `${deployEnv()}_processDeletedImage`,
              {
                runtime: lambda.Runtime.NODEJS_14_X,
                code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
                // code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda-fns/controllers/photos')),
                handler: 'lambdas/processDeletedImage.main',
                memorySize: 3008,
                timeout: cdk.Duration.seconds(30),
                environment: {
                  ...config
                },
              }
            )

        // Grant access to s3 bucket for lambda function
        const imgBucket =
          s3.Bucket.fromBucketName(
            this,
            `wisaw-img-${deployEnv()}`,
            `wisaw-img-${deployEnv()}`
          )
        imgBucket.grantPut(wisawFn)
        imgBucket.grantPutAcl(wisawFn)
        imgBucket.grantPut(processUploadedImageLambdaFunction)
        imgBucket.grantPutAcl(processUploadedImageLambdaFunction)
        imgBucket.grantDelete(processUploadedImageLambdaFunction)

        imgBucket.grantDelete(processDeletedImageLambdaFunction)

        processUploadedImageLambdaFunction.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          // permission policy to allow label detection from rekognition across all resources
          actions: [
            'rekognition:DetectLabels',
            'rekognition:DetectModerationLabels',
            'rekognition:DetectText'
          ],
          resources: ['*']
        }))

        // expiration can't be configured on the exiting bucket programmatically -- has to be done in the admin UI
        // imgBucket.addLifecycleRule({
        //      expiration: cdk.Duration.days(90),
        //    })


    // invoke lambda every time an object is created in the bucket
    imgBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processUploadedImageLambdaFunction),
      // only invoke lambda if object matches the filter
      // {prefix: 'test/', suffix: '.yaml'},
      {suffix: '.upload'},
    )

    // invoke lambda every time an object is deleted in the bucket
    imgBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3n.LambdaDestination(processDeletedImageLambdaFunction),
      // only invoke lambda if object matches the filter
      // {prefix: 'test/', suffix: '.yaml'},
      {suffix: '-thumb'},
    )



    // Grant access to the database from the Lambda function
    database.grantConnect(wisawFn);
    // Set the new Lambda function as a data source for the AppSync API
    const lambdaDs = api.addLambdaDataSource(`lambdaDatasource`, wisawFn);

    // Map the resolvers to the Lambda function

    // ******************************************************
    //                       queries
    // ******************************************************
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'generateUploadUrl'
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'zeroMoment'
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'feedByDate'
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'feedForWatcher'
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'feedForTextSearch'
    })

    // ******************************************************
    //                       mutations
    // ******************************************************
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createContactForm'
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createAbuseReport'
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createPhoto'
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'likePhoto'
    })

    // CFN Outputs
    new cdk.CfnOutput(this, 'AppSyncAPIURL', {
      value: api.graphqlUrl
    })
    new cdk.CfnOutput(this, 'AppSyncAPIKey', {
      value: api.apiKey || ''
    });
    new cdk.CfnOutput(this, 'ProjectRegion', {
      value: this.region
    });
  }
}
