import * as cdk from '@aws-cdk/core'
import * as s3 from "@aws-cdk/aws-s3"
import * as s3n from '@aws-cdk/aws-s3-notifications'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as lambda from '@aws-cdk/aws-lambda'
import * as cloudfront from "@aws-cdk/aws-cloudfront"
import * as origins from "@aws-cdk/aws-cloudfront-origins"
import * as acm from '@aws-cdk/aws-certificatemanager'
import * as route53 from '@aws-cdk/aws-route53'


import {LambdaFunction,} from '@aws-cdk/aws-events-targets'
import {Rule, Schedule,} from '@aws-cdk/aws-events'
import * as rds from '@aws-cdk/aws-rds'
import * as appsync from '@aws-cdk/aws-appsync'
import * as iam from '@aws-cdk/aws-iam'
// import {ISecret, Secret,} from "@aws-cdk/aws-secretsmanager"
// import * as path from 'path'

// const hostedZone =  route53.HostedZone

var path = require('path')

export function deployEnv() {
  return process.env.DEPLOY_ENV || "test"
}

const config = require(`../.env.${deployEnv()}`).config()

// function envSpecific(logicalName: string | Function) {
//   const suffix =
//     typeof logicalName === "function"
//       ? logicalName.name
//       : logicalName

//   return `${deployEnv()}-${suffix}`
// }

export class WiSawCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
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
    })

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
              expires: cdk.Expiration.after(cdk.Duration.days(365)),
            },
          },
        },
        xrayEnabled: true,
      })

    // const prototypeDS = api.addNoneDataSource(`prototypeDataSource`, {
    //   name: "Prototype",
    //   description: "Prototype graphql responses",
    // })

    const layerArn = 'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:14';

    // Create the Lambda function that will map GraphQL operations into Postgres
    const wisawFn = new lambda.Function(this,
      `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk`,
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
        insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn),
        // code: new lambda.AssetCode('lambda-fns'),
        handler: 'index.handler',
        // memorySize: 10240,
        memorySize: 3008,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config,
        },
      }
    )


    // create a layer
    // const ffmpegLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ffmpegLayer',
    //   'arn:aws:lambda:us-east-1:963958500685:layer:ffmpeg:1'
    // )


    // define lambda for thumbnails processing
    const processUploadedImageLambdaFunction =
          new lambda.Function(
            this,
            `${deployEnv()}_processUploadedImage`,
            {
              runtime: lambda.Runtime.NODEJS_14_X,
              code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
              insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn),
              // code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda-fns/controllers/photos')),
              handler: 'lambdas/processUploadedImage.main',
              memorySize: 3008,
              timeout: cdk.Duration.seconds(300),
              // layers: [ffmpegLayer],
              environment: {
                ...config,
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
              insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn),
              // code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda-fns/controllers/photos')),
              handler: 'lambdas/processDeletedImage.main',
              memorySize: 3008,
              timeout: cdk.Duration.seconds(300),
              environment: {
                ...config,
              },
            }
          )

    // define lambda for thumbnails processing
    const processUploadedPrivateImageLambdaFunction =
    new lambda.Function(
      this,
      `${deployEnv()}_processUploadedPrivateImage`,
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
        insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn),
        // code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda-fns/controllers/photos')),
        handler: 'lambdas/processUploadedPrivateImage.main',
        memorySize: 3008,
        timeout: cdk.Duration.seconds(300),
        // layers: [ffmpegLayer],
        environment: {
          ...config,
        },
      }
    )

    // define lambda for thumbnails deletion processing
    const processDeletedPrivateImageLambdaFunction =
    new lambda.Function(
      this,
      `${deployEnv()}_processDeletedPrivateImage`,
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
        insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn),
        // code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda-fns/controllers/photos')),
        handler: 'lambdas/processDeletedPrivateImage.main',
        memorySize: 3008,
        timeout: cdk.Duration.seconds(300),
        environment: {
          ...config,
        },
      }
    )    

    // cleanup older abuse reports
    const cleaupupAbuseReports_LambdaFunction =
      new lambda.Function(
        this,
        `${deployEnv()}_cleaupupAbuseReports`,
        {
          runtime: lambda.Runtime.NODEJS_14_X,
          code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
          insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn),
          handler: 'lambdas/cleaupupAbuseReports.main',
          memorySize: 3008,
          timeout: cdk.Duration.seconds(300),
          environment: {
            ...config,
          },
        }
      )
    const cleaupupAbuseReports_LambdaTarget = new LambdaFunction(cleaupupAbuseReports_LambdaFunction)

    new Rule(this, `${deployEnv()}_lambda-polling-rule`, {
      description: 'Rule to trigger scheduled lambda',
      // schedule: Schedule.rate(cdk.Duration.minutes(1)),
      schedule: Schedule.rate(cdk.Duration.hours(24)),
      targets: [cleaupupAbuseReports_LambdaTarget,],
    })




    if(deployEnv() === 'prod') {
      // generate sitemap.xml lambda
      const generateSiteMap_LambdaFunction =
              new lambda.Function(
                this,
                `${deployEnv()}_generateSiteMap`,
                {
                  runtime: lambda.Runtime.NODEJS_14_X,
                  code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
                  insightsVersion: lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn),
                  // code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda-fns/controllers/photos')),
                  handler: 'lambdas/generateSiteMap.main',
                  memorySize: 3008,
                  timeout: cdk.Duration.seconds(300),
                  environment: {
                    ...config,
                  },
                }
              )
      const generateSiteMapLambdaFunction_LambdaTarget = new LambdaFunction(generateSiteMap_LambdaFunction)

      new Rule(this, 'lambda-polling-rule', {
        description: 'Rule to trigger scheduled lambda',
        // schedule: Schedule.rate(cdk.Duration.minutes(1)),
        schedule: Schedule.rate(cdk.Duration.hours(1)),
        targets: [generateSiteMapLambdaFunction_LambdaTarget,],
      })

      const webAppBucket =
                  s3.Bucket.fromBucketName(
                    this,
                    `wisaw-client`,
                    `wisaw-client`
                  )
      webAppBucket.grantPut(generateSiteMap_LambdaFunction)
      webAppBucket.grantPutAcl(generateSiteMap_LambdaFunction)


      // const myFunc = new cloudfront.experimental.EdgeFunction(this, 'MyFunction', {
      //   runtime: lambda.Runtime.NODEJS_12_X,
      //   handler: 'index.handler',
      //   code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler')),
      // });
      
      // lambda@edge function for ingecting OG meta tags on the fly
      const injectMetaTagsLambdaFunction =
      // new lambda.Function( // trying to define it as an Lambda@Edge function
      new cloudfront.experimental.EdgeFunction(
        this,
        `${deployEnv()}_injectMetaTagsLambdaFunction`,
        {
                  runtime: lambda.Runtime.NODEJS_16_X,
                  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-fns/lambdas/injectMetaTagsLambdaFunction')),
                  // code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
                  handler: 'index.main',
                  memorySize: 128,                  
                  timeout: cdk.Duration.seconds(5),
                  // environment: {
                  //   ...config,
                  // },
        }
      )

      // Origin access identity for cloudfront to access the bucket
      const myCdnOai = new cloudfront.OriginAccessIdentity(this, "CdnOai");
      webAppBucket.grantRead(myCdnOai);
      
      // const wisawCert = acm.Certificate.fromCertificateArn(this, 'wisawCert', "arn:aws:acm:us-east-1:963958500685:certificate/538e85e0-39f4-4d34-8580-86e8729e2c3c")

      new cloudfront.CloudFrontWebDistribution(this, "wisaw-distro", {        
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
                pathPattern: 'photos/*',
                compress: true,
                allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL,
                minTtl: cdk.Duration.days(10),
                maxTtl: cdk.Duration.days(10),
                defaultTtl: cdk.Duration.days(10),
                forwardedValues: {
                  queryString: true,
                  cookies: {
                    forward: 'all'
                  }
                },
                lambdaFunctionAssociations: [
                  {
                  eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
                  lambdaFunction: injectMetaTagsLambdaFunction,       
                  includeBody: true,             
                  }, 
                  // {
                  //   eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE,
                  //   lambdaFunction: injectMetaTagsLambdaFunction,                    
                  // },
                  // {
                  //   eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
                  //   lambdaFunction: injectMetaTagsLambdaFunction,                    
                  //   includeBody: true,             
                  // },
                  // {
                  //   eventType: cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE,
                  //   lambdaFunction: injectMetaTagsLambdaFunction,                    
                  // },

                ]
              }
            ],            
          }, 
        ],
        aliasConfiguration: {
          acmCertRef: "arn:aws:acm:us-east-1:963958500685:certificate/538e85e0-39f4-4d34-8580-86e8729e2c3c", //wisawCert.certificateArn,
          names: ["www.wisaw.com"]
        },
        errorConfigurations: [ 
          {
            errorCode: 403, 
            responseCode: 200,
            errorCachingMinTtl: 31536000,
            responsePagePath: "/index.html"
          },
          {
            errorCode: 404, 
            responseCode: 200,
            errorCachingMinTtl: 31536000,
            responsePagePath: "/index.html"
          }

        ],
      });



      // const distribution = cloudfront.CloudFrontWebDistribution.fromDistributionAttributes(this, 'ImportedDist', {
      //   domainName: 'dqaq70qqy8lyk.cloudfront.net',
      //   distributionId: 'E275CUZVESLWC7',
      //   originConfigs: []        
      // }
      // );

      
      // distribution.
      // addBehavior('photos/23288', wisawClientS3Origin, {
      //   edgeLambdas: [
      //     {
      //       functionVersion: injectMetaTagsLambdaFunction.currentVersion,
      //       eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE,
      //     },
      //   ],
      // })
      

      
      // const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      //   hostedZoneId: "E275CUZVESLWC7",
      //   zoneName: "*.wisaw.com"
      // })

      // Certificate.fromCertificateArn(this, "Cert", "...arn...")
      // const wisawCertificate = new acm.DnsValidatedCertificate(this, '538e85e0-39f4-4d34-8580-86e8729e2c3c', {
      //   domainName: '*.wisaw.com',
      //   // hostedZone,
      // })

      // const wisawClientS3Origin = new origins.S3Origin(webAppBucket)
      // const wisawDistribution = new cloudfront.Distribution(this, 'wisaw-distribution', 
      // {
      //   defaultBehavior: {
      //     origin: wisawClientS3Origin,
      //     // edgeLambdas: [
      //     //   {
      //     //     functionVersion: injectMetaTagsLambdaFunction.currentVersion,
      //     //     eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
      //     //   }
      //     // ],
      //   },
      //   domainNames: ['www.wisaw.com'],
      //   certificate:wisawCertificate,        
      // })

      // wisawDistribution.addBehavior('photos/23288', wisawClientS3Origin, {
      //   edgeLambdas: [
      //     {
      //       functionVersion: injectMetaTagsLambdaFunction.currentVersion,
      //       eventType: cloudfront.LambdaEdgeEventType.VIEWER_RESPONSE,
      //     },
      //   ],
      // })
      


      
      // const version = injectMetaTagsLambdaFunction.addVersion(':sha256:' + sha256('./lambda/index.js'));
      // const version = injectMetaTagsLambdaFunction.currentVersion
      // // A numbered version to give to cloudfront
      // const myOriginRequestHandlerVersion = new lambda.Version(this, "OriginRequestHandlerVersion", {
      //   lambda: injectMetaTagsLambdaFunction,
      // });

      // Origin access identity for cloudfront to access the bucket
      // const distribution = new cloudfront.OriginAccessIdentity(this, `${config.CLOUD_FRONT_DISTRIBUTION}`) // CloudFront distribution
      
      // const distribution = cloudfront.CloudFrontWebDistribution.fromDistributionAttributes(this, `${config.CLOUD_FRONT_DISTRIBUTION}`, {
      //   domainName: 'www.wisaw.com',
      //   distributionId: `${config.CLOUD_FRONT_DISTRIBUTION}`,
      // })


      // const distribution = new cloudfront.Distribution(this, `${config.CLOUD_FRONT_DISTRIBUTION}`, {
      //   defaultBehavior: { origin: new origins.S3Origin(webAppBucket) },
      //   additionalBehaviors: {
      //     'images/*': {
      //       origin: new origins.S3Origin(webAppBucket),
      //       edgeLambdas: [
      //         {
      //           functionVersion: injectMetaTagsLambdaFunction.currentVersion,
      //           eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
      //           includeBody: true, // Optional - defaults to false
      //         },
      //       ],
      //     },
      //   },
      // });


      // const distribution = new cloudfront.Distribution.fromDistributionAttributes(this, `${config.CLOUD_FRONT_DISTRIBUTION}`, {
      //   defaultBehavior: { origin: new origins.S3Origin(webAppBucket) },
      //   additionalBehaviors: {
      //     'images/*': {
      //       origin: new origins.S3Origin(webAppBucket),
      //       edgeLambdas: [
      //         {
      //           functionVersion: injectMetaTagsLambdaFunction.currentVersion,
      //           eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
      //           includeBody: true, // Optional - defaults to false
      //         },
      //       ],
      //     },
      //   },
      // });


      // distribution.addBehavior('/images/*.jpg', new origins.S3Origin(myBucket), {
      //   viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      // });

    
      // const distribution = new cloudfront.CloudFrontWebDistribution(
      //   this,
      //   `${config.CLOUD_FRONT_DISTRIBUTION}`)
      //   // {
        //   domainName: 'www.wisaw.com',
        //   distributionId: `${config.CLOUD_FRONT_DISTRIBUTION}`,
        // });
      //   {
      //     originConfigs: [
      //       {
      //         s3OriginSource: {
      //           s3BucketSource: webAppBucket,
      //         },
      //         behaviors: [
      //           {
      //             isDefaultBehavior: true,
      //             lambdaFunctionAssociations: [
      //               {
      //                 eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
      //                 lambdaFunction: injectMetaTagsLambdaFunction,
      //               },
      //             ],
      //           },
      //         ],
      //       },
      //     ],
      //     loggingConfig: {},
      //     // viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(
      //     //   acmCertificate,
      //     //   {
      //     //     aliases: [DOMAIN],
      //     //   }
      //     // ),
      //   }
      // );


      // webAppBucket.grantRead(distribution)


      // const injectMetaTagsLambdaFunctionUrl = injectMetaTagsLambdaFunction.addFunctionUrl();
      // injectMetaTagsLambdaFunctionUrl.grantInvokeUrl(myRole);

    }

    

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // imgBucket
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
        'rekognition:DetectText',
      ],
      resources: ['*',],
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
      {suffix: '.upload',},
    )

    // invoke lambda every time an object is deleted in the bucket
    imgBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3n.LambdaDestination(processDeletedImageLambdaFunction),
      // only invoke lambda if object matches the filter
      // {prefix: 'test/', suffix: '.yaml'},
      {suffix: '-thumb',},
    )

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // imgPrivateBucket
    // Grant access to s3 bucket for lambda function
    const imgPrivateBucket =
          s3.Bucket.fromBucketName(
            this,
            `wisaw-img-private-${deployEnv()}`,
            `wisaw-img-private-${deployEnv()}`
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
      {suffix: '.upload',},
    )

    // invoke lambda every time an object is deleted in the bucket
    imgPrivateBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3n.LambdaDestination(processDeletedPrivateImageLambdaFunction),
      // only invoke lambda if object matches the filter
      // {prefix: 'test/', suffix: '.yaml'},
      {suffix: '-thumb',},
    )



    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Grant access to the database from the Lambda function
    database.grantConnect(wisawFn)
    // Set the new Lambda function as a data source for the AppSync API
    const lambdaDs = api.addLambdaDataSource(`lambdaDatasource`, wisawFn)

    // Map the resolvers to the Lambda function

    // ******************************************************
    //                       queries
    // ******************************************************
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'generateUploadUrl',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'generateUploadUrlForMessage',
    })

    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'zeroMoment',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'feedByDate',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'feedForWatcher',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'feedForTextSearch',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getPhotoDetails',
    })

    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getPhotoAllCurr',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getPhotoAllNext',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getPhotoAllPrev',
    })


    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getFriendshipsList',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getUnreadCountsList',
    })
    lambdaDs.createResolver({
      typeName: 'Query',
      fieldName: 'getMessagesList',
    })

    // ******************************************************
    //                       mutations
    // ******************************************************
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createContactForm',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createAbuseReport',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createPhoto',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'watchPhoto',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'unwatchPhoto',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'deletePhoto',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createComment',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'deleteComment',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'registerSecret',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'updateSecret',
    })


    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'createFriendship',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'acceptFriendshipRequest',
    })
    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'deleteFriendship',
    })

    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'sendMessage',
    })

    lambdaDs.createResolver({
      typeName: 'Mutation',
      fieldName: 'resetUnreadCount',
    })


    // CFN Outputs
    new cdk.CfnOutput(this, 'AppSyncAPIURL', {
      value: api.graphqlUrl,
    })
    new cdk.CfnOutput(this, 'AppSyncAPIKey', {
      value: api.apiKey || '',
    })
    new cdk.CfnOutput(this, 'ProjectRegion', {
      value: this.region,
    })
  }
}
