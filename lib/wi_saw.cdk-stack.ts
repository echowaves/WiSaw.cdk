import * as cdk from "aws-cdk-lib"

import * as ec2 from "aws-cdk-lib/aws-ec2"
import * as s3 from "aws-cdk-lib/aws-s3"

import * as s3n from "aws-cdk-lib/aws-s3-notifications"

import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as lambda from "aws-cdk-lib/aws-lambda"

import * as logs from "aws-cdk-lib/aws-logs"

import * as acm from "aws-cdk-lib/aws-certificatemanager"
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets"
import { NodejsFunction, SourceMapMode } from "aws-cdk-lib/aws-lambda-nodejs"

import * as appsync from "aws-cdk-lib/aws-appsync"
// import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins'

import { Rule, Schedule } from "aws-cdk-lib/aws-events"
import * as iam from "aws-cdk-lib/aws-iam"
import * as rds from "aws-cdk-lib/aws-rds"

import { Construct } from "constructs"

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
        definition: {
          schema: appsync.SchemaFile.fromAsset("graphql/schema.graphql"),
        },
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
    const logRetention = logs.RetentionDays.ONE_DAY

    const sharpLayerArn =
      "arn:aws:lambda:us-east-1:963958500685:layer:sharp-layer:2"

    // Create the Lambda function that will map GraphQL operations into Postgres
    const wisawFn = new NodejsFunction(
      this,
      `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          // externalModules: ["sharp"],
        },
        // layers: [
        //   lambda.LayerVersion.fromLayerVersionArn(
        //     this,
        //     `${deployEnv()}-GraphQlMapFunction`,
        //     sharpLayerArn,
        //   ),
        // ],
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
        runtime: lambda.Runtime.NODEJS_22_X,
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
        runtime: lambda.Runtime.NODEJS_22_X,
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
        runtime: lambda.Runtime.NODEJS_22_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/lambdas/processDeletedImage/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          // externalModules: ["sharp"],
        },
        // layers: [
        //   lambda.LayerVersion.fromLayerVersionArn(
        //     this,
        //     `${deployEnv()}-_processDeletedImage`,
        //     sharpLayerArn,
        //   ),
        // ],
        insightsVersion,
        logRetention,
        // memorySize: 10240,
        memorySize: 1024,
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
        runtime: lambda.Runtime.NODEJS_22_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/lambdas/processDeletedPrivateImage/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          // externalModules: ["sharp"],
        },
        // layers: [
        //   lambda.LayerVersion.fromLayerVersionArn(
        //     this,
        //     `${deployEnv()}-_processDeletedPrivateImage`,
        //     sharpLayerArn,
        //   ),
        // ],
        insightsVersion,
        logRetention,
        // memorySize: 10240,
        memorySize: 1024,
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
        runtime: lambda.Runtime.NODEJS_22_X,
        // handler: "index.handler",
        entry: `${__dirname}/../lambda-fns/lambdas/cleaupupAbuseReports/index.ts`,
        handler: "main",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false,
          // externalModules: ["sharp"],
        },
        // layers: [
        //   lambda.LayerVersion.fromLayerVersionArn(
        //     this,
        //     `${deployEnv()}-_cleaupupAbuseReports`,
        //     sharpLayerArn,
        //   ),
        // ],
        insightsVersion,
        logRetention,
        // memorySize: 10240,
        memorySize: 1024,
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
    imgBucket.grantReadWrite(wisawFn)
    imgBucket.grantReadWrite(processUploadedImageLambdaFunction)
    imgBucket.grantPut(processUploadedImageLambdaFunction)
    imgBucket.grantPutAcl(processUploadedImageLambdaFunction)
    imgBucket.grantDelete(processUploadedImageLambdaFunction)

    imgBucket.grantDelete(processDeletedImageLambdaFunction)



    if (deployEnv() === "prod") {
      const generateSiteMap_LambdaFunction = new NodejsFunction(
        this,
        `${deployEnv()}_generateSiteMap`,
        {
          runtime: lambda.Runtime.NODEJS_22_X,
          // handler: "index.handler",
          entry: `${__dirname}/../lambda-fns/lambdas/generateSiteMap/index.ts`,
          handler: "main",
          bundling: {
            minify: true,
            target: "es2020",
            sourceMap: true,
            sourceMapMode: SourceMapMode.INLINE,
            sourcesContent: false,
            // externalModules: ["sharp"],
          },
          // layers: [
          //   lambda.LayerVersion.fromLayerVersionArn(
          //     this,
          //     `${deployEnv()}-_generateSiteMap`,
          //     sharpLayerArn,
          //   ),
          // ],
          insightsVersion,
          logRetention,
          memorySize: 1024,
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
        schedule: Schedule.rate(cdk.Duration.hours(5)),
        targets: [generateSiteMapLambdaFunction_LambdaTarget],
      })

      const webAppBucket = s3.Bucket.fromBucketName(
        this,
        `wisaw.com`,
        `wisaw.com`,
      )
      webAppBucket.grantPut(generateSiteMap_LambdaFunction)
      webAppBucket.grantPutAcl(generateSiteMap_LambdaFunction)

      // lambda@edge function for ingecting OG meta tags on the fly
      const injectMetaTagsLambdaFunction_photo =
        // new lambda.Function( // trying to define it as an Lambda@Edge function
        new cloudfront.experimental.EdgeFunction(
          this,
          `${deployEnv()}_injectPhotoMetaTagsLambdaFunction_photo`,
          {
            runtime: lambda.Runtime.NODEJS_22_X,
            code: lambda.Code.fromAsset(
              path.join(
                __dirname,
                "../lambda-fns/lambdas/injectMetaTagsLambdaFunction",
              ),
            ),
            // code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
            handler: "photo.handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            // insightsVersion,
            logRetention,
            // environment: {
            //   ...config,
            // },
          },
        )
      webAppBucket.grantRead(injectMetaTagsLambdaFunction_photo)
      imgBucket.grantReadWrite(injectMetaTagsLambdaFunction_photo)
      
      const injectMetaTagsLambdaFunction_video =
        // new lambda.Function( // trying to define it as an Lambda@Edge function
        new cloudfront.experimental.EdgeFunction(
          this,
          `${deployEnv()}_injectPhotoMetaTagsLambdaFunction_video`,
          {
            runtime: lambda.Runtime.NODEJS_22_X,
            code: lambda.Code.fromAsset(
              path.join(
                __dirname,
                "../lambda-fns/lambdas/injectMetaTagsLambdaFunction",
              ),
            ),
            // code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
            handler: "video.handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            // insightsVersion,
            logRetention,
            // environment: {
            //   ...config,
            // },
          },
        )
      webAppBucket.grantRead(injectMetaTagsLambdaFunction_video)
      imgBucket.grantReadWrite(injectMetaTagsLambdaFunction_video)
      
      const redirectLambdaEdgeFunction =
        // new lambda.Function( // trying to define it as an Lambda@Edge function
        new cloudfront.experimental.EdgeFunction(
          this,
          `${deployEnv()}_redirectLambdaEdgeFunction`,
          {
            runtime: lambda.Runtime.NODEJS_22_X,
            code: lambda.Code.fromAsset(
              path.join(
                __dirname,
                "../lambda-fns/lambdas/redirectLambdaEdgeFunction",
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
      webAppBucket.grantRead(redirectLambdaEdgeFunction)
      // imgBucket.grantReadWrite(redirectLambdaEdgeFunction)
      
      

      // Add Origin Access Control (OAC) - the modern replacement for OAI
      const myOac = new cloudfront.CfnOriginAccessControl(this, 'MyCdnOac', {
        originAccessControlConfig: {
          name: `wisaw-s3-oac-${deployEnv()}`,
          originAccessControlOriginType: 's3',
          signingBehavior: 'always',
          signingProtocol: 'sigv4'
        }
      });
      
      // Use the ACM certificate
      const cert = acm.Certificate.fromCertificateArn(
        this,
        "my_cert",
        "arn:aws:acm:us-east-1:963958500685:certificate/cf8703c9-9c1b-4405-bc10-a0c3287ebb7e"
      )

      // Create cache policies
      const basicCachePolicy = new cloudfront.CachePolicy(this, 'BasicCachePolicy', {
        defaultTtl: cdk.Duration.days(10),
        minTtl: cdk.Duration.days(10),
        maxTtl: cdk.Duration.days(10),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        cookieBehavior: cloudfront.CacheCookieBehavior.all(),
      });

      // Create origin request policy that forwards all cookies and query strings
      const allForwardPolicy = new cloudfront.OriginRequestPolicy(this, 'AllForwardPolicy', {
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.none(),
      });

      // Create the CloudFront distribution with S3 as an origin
      const distribution = new cloudfront.Distribution(this, "wisaw-distro", {
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        defaultBehavior: {
          origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
          compress: true,
          cachePolicy: basicCachePolicy,
          originRequestPolicy: allForwardPolicy,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
          edgeLambdas: [
            {
              eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
              functionVersion: redirectLambdaEdgeFunction.currentVersion,
              includeBody: true,
            },
          ],
        },
        additionalBehaviors: {
          "photos/*": {
            origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
            compress: true,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: basicCachePolicy,
            originRequestPolicy: allForwardPolicy,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
            edgeLambdas: [
           {
              eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
              functionVersion: redirectLambdaEdgeFunction.currentVersion,
              includeBody: true,
            },

              {
                eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
                functionVersion: injectMetaTagsLambdaFunction_photo.currentVersion,
                includeBody: true,
              }
            ],
          },
          "videos/*": {
            origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
            compress: true,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: basicCachePolicy,
            originRequestPolicy: allForwardPolicy,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
            edgeLambdas: [
            {
              eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
              functionVersion: redirectLambdaEdgeFunction.currentVersion,
              includeBody: true,
            },

              {
                eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
                functionVersion: injectMetaTagsLambdaFunction_video.currentVersion,
                includeBody: true,
              }
            ],
          },
        },
        certificate: cert,
        domainNames: ["www.wisaw.com", "wisaw.com"],
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            ttl: cdk.Duration.days(365),
            responsePagePath: "/index.html",
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            ttl: cdk.Duration.days(365),
            responsePagePath: "/index.html",
          },
        ],
      });

      // Output the Distribution ID to use in the OAC bucket policy
      new cdk.CfnOutput(this, "CloudFrontDistributionId", {
        value: distribution.distributionId,
        description: "Use this Distribution ID in the OAC bucket policy for wisaw.com"
      })

      // Apply the OAC to the CloudFront distribution
      const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
      
      // Connect OAC to the default behavior
      cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', myOac.attrId);
      
      // Remove OAI from default origin (required for OAC)
      cfnDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');
      
      // For additional behaviors
      cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.OriginAccessControlId', myOac.attrId);
      cfnDistribution.addPropertyOverride('DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity', '');
      
      cfnDistribution.addPropertyOverride('DistributionConfig.Origins.2.OriginAccessControlId', myOac.attrId);
      cfnDistribution.addPropertyOverride('DistributionConfig.Origins.2.S3OriginConfig.OriginAccessIdentity', '');
    }


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
    imgPrivateBucket.grantReadWrite(processUploadedPrivateImageLambdaFunction)
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