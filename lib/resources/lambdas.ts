import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import * as path from 'path'
import { deployEnv } from '../utilities/config'

export function createLambdas (scope: Construct, config: any): any {
  const layerArn =
    'arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:14'
  const insightsVersion =
    lambda.LambdaInsightsVersion.fromInsightVersionArn(layerArn)
  const logRetention = logs.RetentionDays.ONE_DAY

  const sharpLayerArn =
    'arn:aws:lambda:us-east-1:963958500685:layer:sharp-layer:2'

  // Create the Lambda function that will map GraphQL operations into Postgres
  const wisawFn = new NodejsFunction(
    scope,
    `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: `${__dirname}/../../lambda-fns/index.ts`,
      handler: 'main',
      bundling: {
        minify: true,
        target: 'es2020',
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false
        // externalModules: ["sharp"],
      },
      // layers: [
      //   lambda.LayerVersion.fromLayerVersionArn(
      //     scope,
      //     `${deployEnv()}-GraphQlMapFunction`,
      //     sharpLayerArn,
      //   ),
      // ],
      insightsVersion,
      logRetention,
      memorySize: 10240,
      // memorySize: 3008,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const processUploadedImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processUploadedImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../../lambda-fns/lambdas/processUploadedImage/index.ts`,
      handler: 'main',
      bundling: {
        minify: true,
        target: 'es2020',
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false,
        externalModules: ['sharp']
      },
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          scope,
          `${deployEnv()}-processUploadedImage`,
          sharpLayerArn
        )
      ],
      insightsVersion,
      logRetention,
      memorySize: 10240,
      // memorySize: 3008,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const processUploadedPrivateImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processUploadedPrivateImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: `${__dirname}/../../lambda-fns/lambdas/processUploadedPrivateImage/index.ts`,
      handler: 'main',
      bundling: {
        minify: true,
        target: 'es2020',
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false,
        externalModules: ['sharp']
      },
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          scope,
          `${deployEnv()}-processUploadedPrivateImage`,
          sharpLayerArn
        )
      ],
      insightsVersion,
      logRetention,
      memorySize: 10240,
      // memorySize: 3008,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const processDeletedImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processDeletedImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: `${__dirname}/../../lambda-fns/lambdas/processDeletedImage/index.ts`,
      handler: 'main',
      bundling: {
        minify: true,
        target: 'es2020',
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false
        // externalModules: ["sharp"],
      },
      // layers: [
      //   lambda.LayerVersion.fromLayerVersionArn(
      //     scope,
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
        ...config
      }
    }
  )

  const processDeletedPrivateImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processDeletedPrivateImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: `${__dirname}/../../lambda-fns/lambdas/processDeletedPrivateImage/index.ts`,
      handler: 'main',
      bundling: {
        minify: true,
        target: 'es2020',
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false
        // externalModules: ["sharp"],
      },
      // layers: [
      //   lambda.LayerVersion.fromLayerVersionArn(
      //     scope,
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
        ...config
      }
    }
  )

  const cleanupAbuseReports_LambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_cleaupupAbuseReports`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: `${__dirname}/../../lambda-fns/lambdas/cleaupupAbuseReports/index.ts`,
      handler: 'main',
      bundling: {
        minify: true,
        target: 'es2020',
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false
        // externalModules: ["sharp"],
      },
      // layers: [
      //   lambda.LayerVersion.fromLayerVersionArn(
      //     scope,
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
        ...config
      }
    }
  )

  const cleaupupAbuseReports_LambdaTarget = new LambdaFunction(
    cleanupAbuseReports_LambdaFunction
  )

  // eslint-disable-next-line no-new
  new Rule(scope, `${deployEnv()}_lambda-polling-rule`, {
    description: 'Rule to trigger scheduled lambda',
    // schedule: Schedule.rate(cdk.Duration.minutes(1)),
    schedule: Schedule.rate(cdk.Duration.hours(24)),
    targets: [cleaupupAbuseReports_LambdaTarget]
  })

  let generateSiteMap_LambdaFunction: NodejsFunction | undefined
  let injectMetaTagsLambdaFunction_photo: cloudfront.experimental.EdgeFunction | undefined
  let injectMetaTagsLambdaFunction_video: cloudfront.experimental.EdgeFunction | undefined
  let redirectLambdaEdgeFunction: cloudfront.experimental.EdgeFunction | undefined

  if (deployEnv() === 'prod') {
    generateSiteMap_LambdaFunction = new NodejsFunction(
      scope,
      `${deployEnv()}_generateSiteMap`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../../lambda-fns/lambdas/generateSiteMap/index.ts`,
        handler: 'main',
        bundling: {
          minify: true,
          target: 'es2020',
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false
        },
        insightsVersion,
        logRetention,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config
        }
        // role: lambdaExecutionRole, // Assign the imported role to the Lambda function
      }
    )

    const generateSiteMapLambdaFunction_LambdaTarget = new LambdaFunction(
      generateSiteMap_LambdaFunction
    )

    // eslint-disable-next-line no-new
    new Rule(scope, 'lambda-polling-rule', {
      description: 'Rule to trigger scheduled lambda',
      schedule: Schedule.rate(cdk.Duration.hours(5)),
      // schedule: Schedule.rate(cdk.Duration.minutes(1)),
      targets: [generateSiteMapLambdaFunction_LambdaTarget]
    })

    // lambda@edge function for ingecting OG meta tags on the fly
    injectMetaTagsLambdaFunction_photo =
      // new lambda.Function( // trying to define it as an Lambda@Edge function
      new cloudfront.experimental.EdgeFunction(
        scope,
        `${deployEnv()}_injectPhotoMetaTagsLambdaFunction_photo`,
        {
          runtime: lambda.Runtime.NODEJS_22_X,
          code: lambda.Code.fromAsset(
            path.join(
              __dirname,
              '../../lambda-fns/lambdas/injectMetaTagsLambdaFunction'
            )
          ),
          // code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
          handler: 'photo.handler',
          memorySize: 128,
          timeout: cdk.Duration.seconds(5),
          // insightsVersion,
          logRetention
          // environment: {
          //   ...config,
          // },
        }
      )

    injectMetaTagsLambdaFunction_video =
      // new lambda.Function( // trying to define it as an Lambda@Edge function
      new cloudfront.experimental.EdgeFunction(
        scope,
        `${deployEnv()}_injectPhotoMetaTagsLambdaFunction_video`,
        {
          runtime: lambda.Runtime.NODEJS_22_X,
          code: lambda.Code.fromAsset(
            path.join(
              __dirname,
              '../../lambda-fns/lambdas/injectMetaTagsLambdaFunction'
            )
          ),
          // code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
          handler: 'video.handler',
          memorySize: 128,
          timeout: cdk.Duration.seconds(5),
          // insightsVersion,
          logRetention
          // environment: {
          //   ...config,
          // },
        }
      )

    redirectLambdaEdgeFunction =
      // new lambda.Function( // trying to define it as an Lambda@Edge function
      new cloudfront.experimental.EdgeFunction(
        scope,
        `${deployEnv()}_redirectLambdaEdgeFunction`,
        {
          runtime: lambda.Runtime.NODEJS_22_X,
          code: lambda.Code.fromAsset(
            path.join(
              __dirname,
              '../../lambda-fns/lambdas/redirectLambdaEdgeFunction'
            )
          ),
          // code: lambda.Code.fromAsset('lambda-fns/lambdas.zip'),
          handler: 'index.handler',
          memorySize: 128,
          timeout: cdk.Duration.seconds(5),
          // insightsVersion,
          logRetention
          // environment: {
          //   ...config,
          // },
        }
      )
  }

  processUploadedImageLambdaFunction.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      // permission policy to allow label detection from rekognition across all resources
      actions: [
        'rekognition:DetectLabels',
        'rekognition:DetectModerationLabels',
        'rekognition:DetectText'
      ],
      resources: ['*']
    })
  )

  return {
    wisawFn,
    processUploadedImageLambdaFunction,
    processUploadedPrivateImageLambdaFunction,
    processDeletedImageLambdaFunction,
    processDeletedPrivateImageLambdaFunction,
    cleanupAbuseReports_LambdaFunction,
    generateSiteMap_LambdaFunction,
    injectMetaTagsLambdaFunction_photo,
    injectMetaTagsLambdaFunction_video,
    redirectLambdaEdgeFunction
  }
}
