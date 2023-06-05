import * as cdk from "aws-cdk-lib"

import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as s3 from "aws-cdk-lib/aws-s3"

import * as s3n from "aws-cdk-lib/aws-s3-notifications"

import * as lambda from "aws-cdk-lib/aws-lambda"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"

import * as logs from "aws-cdk-lib/aws-logs"

import { LambdaFunction } from "aws-cdk-lib/aws-events-targets"
import { Certificate } from "aws-cdk-lib/aws-certificatemanager"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import { SourceMapMode } from "aws-cdk-lib/aws-lambda-nodejs"
import { Architecture } from "aws-cdk-lib/aws-lambda"

import { Rule, Schedule } from "aws-cdk-lib/aws-events"
import * as rds from "aws-cdk-lib/aws-rds"
import * as appsync from "aws-cdk-lib/aws-appsync"
import * as iam from "aws-cdk-lib/aws-iam"

import { Construct } from "constructs"
import { TagOptions } from "aws-cdk-lib/aws-servicecatalog"

// import {ISecret, Secret,} from "@aws-cdk/aws-secretsmanager"
// import * as path from 'path'

// const hostedZone =  route53.HostedZone

var path = require("path")

export function deployEnv() {
  return process.env.DEPLOY_ENV || "test"
}

const config = require(`../.env.${deployEnv()}`).config()

export class WiSawCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // will refer to already created DB instance instead of creating new one.
    const database = rds.DatabaseInstance.fromDatabaseInstanceAttributes(
      this,
      `wisaw-${deployEnv()}`,
      {
        instanceIdentifier: `wisaw-${deployEnv()}`,
        instanceResourceId: config.DB_RESOURCE_ID,
        instanceEndpointAddress: `wisaw-${deployEnv()}.cbaw0b5dcxjh.us-east-1.rds.amazonaws.com`,
        port: 5432,
        securityGroups: [],
      },
    )

    database.connections.allowFromAnyIpv4(ec2.Port.tcp(parseInt(config.port)))
    database.connections.allowDefaultPortInternally()

    // Create the AppSync API
    const api = new appsync.GraphqlApi(
      this,
      `${deployEnv()}-WiSaw-appsyncApi-cdk`,
      {
        name: `${deployEnv()}-cdk-wisaw-appsync-api`,
        schema: appsync.SchemaFile.fromAsset("graphql/schema.graphql"),
        authorizationConfig: {
          defaultAuthorization: {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              expires: cdk.Expiration.after(cdk.Duration.days(365)),
            },
          },
        },
        xrayEnabled: true,
      },
    )

    const layerArn =
      "arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:14"
    const insightsVersion =
      lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn)
    const logRetention = logs.RetentionDays.TWO_WEEKS

    const sharpLayerArn =
      "arn:aws:lambda:us-east-1:963958500685:layer:sharp-layer:2"

    // Create the Lambda function that will map GraphQL operations into Postgres
    const wisawFn = new NodejsFunction(
      this,
      `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          externalModules: ["sharp"],
        },
        layers: [
          lambda.LayerVersion.fromLayerVersionArn(
            this,
            `${deployEnv()}-GraphQlMapFunction`,
            sharpLayerArn,
          ),
        ],
        insightsVersion,
        logRetention,
        memorySize: 10240,
        // memorySize: 3008,
        timeout: cdk.Duration.seconds(15),
        environment: {
          ...config,
        },
      },
    )

    const processUploadedImageLambdaFunction = new NodejsFunction(
      this,
      `${deployEnv()}_processUploadedImage`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambda-fns/lambdas/processUploadedImage/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          externalModules: ["sharp"],
        },
        layers: [
          lambda.LayerVersion.fromLayerVersionArn(
            this,
            `${deployEnv()}-processUploadedImage`,
            sharpLayerArn,
          ),
        ],
        insightsVersion,
        logRetention,
        memorySize: 10240,
        // memorySize: 3008,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config,
        },
      },
    )

    const processUploadedPrivateImageLambdaFunction = new NodejsFunction(
      this,
      `${deployEnv()}_processUploadedPrivateImage`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambda-fns/lambdas/processUploadedPrivateImage/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          externalModules: ["sharp"],
        },
        layers: [
          lambda.LayerVersion.fromLayerVersionArn(
            this,
            `${deployEnv()}-processUploadedPrivateImage`,
            sharpLayerArn,
          ),
        ],
        insightsVersion,
        logRetention,
        memorySize: 10240,
        // memorySize: 3008,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config,
        },
      },
    )

    const processDeletedImageLambdaFunction = new NodejsFunction(
      this,
      `${deployEnv()}_processDeletedImage`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/lambdas/processDeletedImage/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          externalModules: ["sharp"],
        },
        layers: [
          lambda.LayerVersion.fromLayerVersionArn(
            this,
            `${deployEnv()}-_processDeletedImage`,
            sharpLayerArn,
          ),
        ],
        insightsVersion,
        logRetention,
        memorySize: 10240,
        // memorySize: 3008,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config,
        },
      },
    )

    const processDeletedPrivateImageLambdaFunction = new NodejsFunction(
      this,
      `${deployEnv()}_processDeletedPrivateImage`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/lambdas/processDeletedPrivateImage/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          externalModules: ["sharp"],
        },
        layers: [
          lambda.LayerVersion.fromLayerVersionArn(
            this,
            `${deployEnv()}-_processDeletedPrivateImage`,
            sharpLayerArn,
          ),
        ],
        insightsVersion,
        logRetention,
        memorySize: 10240,
        // memorySize: 3008,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config,
        },
      },
    )

    const cleanupAbuseReports_LambdaFunction = new NodejsFunction(
      this,
      `${deployEnv()}_cleaupupAbuseReports`,
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/lambdas/cleaupupAbuseReports/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          externalModules: ["sharp"],
        },
        layers: [
          lambda.LayerVersion.fromLayerVersionArn(
            this,
            `${deployEnv()}-_cleaupupAbuseReports`,
            sharpLayerArn,
          ),
        ],
        insightsVersion,
        logRetention,
        memorySize: 10240,
        // memorySize: 3008,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config,
        },
      },
    )

    const cleaupupAbuseReports_LambdaTarget = new LambdaFunction(
      cleanupAbuseReports_LambdaFunction,
    )

    new Rule(this, `${deployEnv()}_lambda-polling-rule`, {
      description: "Rule to trigger scheduled lambda",
      // schedule: Schedule.rate(cdk.Duration.minutes(1)),
      schedule: Schedule.rate(cdk.Duration.hours(24)),
      targets: [cleaupupAbuseReports_LambdaTarget],
    })

    if (deployEnv() === "prod") {
      const generateSiteMap_LambdaFunction = new NodejsFunction(
        this,
        `${deployEnv()}_generateSiteMap`,
        {
          runtime: lambda.Runtime.NODEJS_18_X,
          // handler: "index.handler",
          entry: `${__dirname}/../lambda-fns/lambdas/generateSiteMap/index.ts`,
          handler: "main",
          bundling: {
            minify: true,
            target: "es2020",
            sourceMap: true,
            sourceMapMode: SourceMapMode.INLINE,
            sourcesContent: false,
            externalModules: ["sharp"],
          },
          layers: [
            lambda.LayerVersion.fromLayerVersionArn(
              this,
              `${deployEnv()}-_generateSiteMap`,
              sharpLayerArn,
            ),
          ],
          insightsVersion,
          logRetention,
          memorySize: 10240,
          // memorySize: 3008,
          timeout: cdk.Duration.seconds(30),
          environment: {
            ...config,
          },
        },
      )

      const generateSiteMapLambdaFunction_LambdaTarget = new LambdaFunction(
        generateSiteMap_LambdaFunction,
      )

      new Rule(this, "lambda-polling-rule", {
        description: "Rule to trigger scheduled lambda",
        // schedule: Schedule.rate(cdk.Duration.minutes(1)),
        schedule: Schedule.rate(cdk.Duration.hours(1)),
        targets: [generateSiteMapLambdaFunction_LambdaTarget],
      })

      const webAppBucket = s3.Bucket.fromBucketName(
        this,
        `wisaw-client`,
        `wisaw-client`,
      )
      webAppBucket.grantPut(generateSiteMap_LambdaFunction)
      webAppBucket.grantPutAcl(generateSiteMap_LambdaFunction)

      // lambda@edge function for ingecting OG meta tags on the fly
      const injectMetaTagsLambdaFunction =
        // new lambda.Function( // trying to define it as an Lambda@Edge function
        new cloudfront.experimental.EdgeFunction(
          this,
          `${deployEnv()}_injectMetaTagsLambdaFunction`,
          {
            runtime: lambda.Runtime.NODEJS_14_X,
            code: lambda.Code.fromAsset(
              path.join(
                __dirname,
                "../lambda-fns/lambdas/injectMetaTagsLambdaFunction",
              ),
            ),
            // code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
            handler: "index.handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            // insightsVersion,
            logRetention,
            // environment: {
            //   ...config,
            // },
          },
        )
      webAppBucket.grantRead(injectMetaTagsLambdaFunction)

      // Origin access identity for cloudfront to access the bucket
      const myCdnOai = new cloudfront.OriginAccessIdentity(this, "CdnOai")
      webAppBucket.grantRead(myCdnOai)

      // const wisawCert = acm.Certificate.fromCertificateArn(this, 'wisawCert', "arn:aws:acm:us-east-1:963958500685:certificate/538e85e0-39f4-4d34-8580-86e8729e2c3c")

      const viewerCertificate = cloudfront.ViewerCertificate.fromAcmCertificate(
        Certificate.fromCertificateArn(
          this,
          "my_cert",
          "arn:aws:acm:us-east-1:963958500685:certificate/538e85e0-39f4-4d34-8580-86e8729e2c3c",
        ),
        {
          aliases: ["www.wisaw.com"],
          securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
          sslMethod: cloudfront.SSLMethod.SNI, // default
        },
      )

      new cloudfront.CloudFrontWebDistribution(this, "wisaw-distro", {
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: webAppBucket,
              originAccessIdentity: myCdnOai,
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                compress: true,
              },
              {
                pathPattern: "photos/*",
                compress: true,
                allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL,
                minTtl: cdk.Duration.days(10),
                maxTtl: cdk.Duration.days(10),
                defaultTtl: cdk.Duration.days(10),
                forwardedValues: {
                  queryString: true,
                  cookies: {
                    forward: "all",
                  },
                },
                lambdaFunctionAssociations: [
                  {
                    eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
                    lambdaFunction: injectMetaTagsLambdaFunction,
                    includeBody: true,
                  },
                ],
              },
            ],
          },
        ],
        viewerCertificate,
        errorConfigurations: [
          {
            errorCode: 403,
            responseCode: 200,
            errorCachingMinTtl: 31536000,
            responsePagePath: "/index.html",
          },
          {
            errorCode: 404,
            responseCode: 200,
            errorCachingMinTtl: 31536000,
            responsePagePath: "/index.html",
          },
        ],
      })
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // imgBucket
    // Grant access to s3 bucket for lambda function
    const imgBucket = s3.Bucket.fromBucketName(
      this,
      `wisaw-img-${deployEnv()}`,
      `wisaw-img-${deployEnv()}`,
    )
    imgBucket.grantPut(wisawFn)
    imgBucket.grantPutAcl(wisawFn)
    imgBucket.grantPut(processUploadedImageLambdaFunction)
    imgBucket.grantPutAcl(processUploadedImageLambdaFunction)
    imgBucket.grantDelete(processUploadedImageLambdaFunction)

    imgBucket.grantDelete(processDeletedImageLambdaFunction)

    processUploadedImageLambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        // permission policy to allow label detection from rekognition across all resources
        actions: [
          "rekognition:DetectLabels",
          "rekognition:DetectModerationLabels",
          "rekognition:DetectText",
        ],
        resources: ["*"],
      }),
    )

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
      { suffix: ".upload" },
    )

    // invoke lambda every time an object is deleted in the bucket
    imgBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3n.LambdaDestination(processDeletedImageLambdaFunction),
      // only invoke lambda if object matches the filter
      // {prefix: 'test/', suffix: '.yaml'},
      { suffix: "-thumb" },
    )

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // imgPrivateBucket
    // Grant access to s3 bucket for lambda function
    const imgPrivateBucket = s3.Bucket.fromBucketName(
      this,
      `wisaw-img-private-${deployEnv()}`,
      `wisaw-img-private-${deployEnv()}`,
    )
    imgPrivateBucket.grantPut(wisawFn)
    imgPrivateBucket.grantPutAcl(wisawFn)
    imgPrivateBucket.grantPut(processUploadedPrivateImageLambdaFunction)
    imgPrivateBucket.grantPutAcl(processUploadedPrivateImageLambdaFunction)
    imgPrivateBucket.grantDelete(processUploadedPrivateImageLambdaFunction)

    imgPrivateBucket.grantDelete(processDeletedPrivateImageLambdaFunction)

    // invoke lambda every time an object is created in the bucket
    imgPrivateBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(processUploadedPrivateImageLambdaFunction),
      // only invoke lambda if object matches the filter
      // {prefix: 'test/', suffix: '.yaml'},
      { suffix: ".upload" },
    )

    // invoke lambda every time an object is deleted in the bucket
    imgPrivateBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3n.LambdaDestination(processDeletedPrivateImageLambdaFunction),
      // only invoke lambda if object matches the filter
      // {prefix: 'test/', suffix: '.yaml'},
      { suffix: "-thumb" },
    )

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Grant access to the database from the Lambda function
    database.grantConnect(wisawFn, config.username)

    // Set the new Lambda function as a data source for the AppSync API
    const lambdaDs = api.addLambdaDataSource(`lambdaDatasource`, wisawFn)

    // Map the resolvers to the Lambda function

    const fields = [
      { typeName: "Query", fieldName: "generateUploadUrl" },
      { typeName: "Query", fieldName: "generateUploadUrlForMessage" },
      { typeName: "Query", fieldName: "zeroMoment" },
      { typeName: "Query", fieldName: "feedByDate" },
      { typeName: "Query", fieldName: "feedForWatcher" },
      { typeName: "Query", fieldName: "feedRecent" },
      { typeName: "Query", fieldName: "feedForTextSearch" },
      { typeName: "Query", fieldName: "getPhotoDetails" },
      { typeName: "Query", fieldName: "getPhotoAllCurr" },
      { typeName: "Query", fieldName: "getPhotoAllNext" },
      { typeName: "Query", fieldName: "getPhotoAllPrev" },
      { typeName: "Query", fieldName: "getFriendshipsList" },
      { typeName: "Query", fieldName: "getUnreadCountsList" },
      { typeName: "Query", fieldName: "getMessagesList" },

      { typeName: "Mutation", fieldName: "createContactForm" },
      { typeName: "Mutation", fieldName: "createAbuseReport" },
      { typeName: "Mutation", fieldName: "createPhoto" },
      { typeName: "Mutation", fieldName: "watchPhoto" },
      { typeName: "Mutation", fieldName: "unwatchPhoto" },
      { typeName: "Mutation", fieldName: "deletePhoto" },
      { typeName: "Mutation", fieldName: "createComment" },
      { typeName: "Mutation", fieldName: "deleteComment" },
      { typeName: "Mutation", fieldName: "registerSecret" },
      { typeName: "Mutation", fieldName: "updateSecret" },
      { typeName: "Mutation", fieldName: "createFriendship" },
      { typeName: "Mutation", fieldName: "acceptFriendshipRequest" },
      { typeName: "Mutation", fieldName: "deleteFriendship" },
      { typeName: "Mutation", fieldName: "sendMessage" },
      { typeName: "Mutation", fieldName: "resetUnreadCount" },
    ]
    fields.forEach(({ typeName, fieldName }) =>
      lambdaDs.createResolver(`${typeName}-${fieldName}-Resolver`, {
        typeName,
        fieldName,
      }),
    )
    // CFN Outputs
    new cdk.CfnOutput(this, "AppSyncAPIURL", {
      value: api.graphqlUrl,
    })
    new cdk.CfnOutput(this, "AppSyncAPIKey", {
      value: api.apiKey || "",
    })
    new cdk.CfnOutput(this, "ProjectRegion", {
      value: this.region,
    })
  }
}
