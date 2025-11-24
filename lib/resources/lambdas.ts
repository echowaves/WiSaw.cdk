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

  const sharpLayerArn =
    'arn:aws:lambda:us-east-1:963958500685:layer:sharp-layer:2'

  // Create the Lambda function that will map GraphQL operations into Postgres
  const wisawFnLogGroup = new logs.LogGroup(scope, `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk-LogGroup`, {
    logGroupName: `/aws/lambda/${deployEnv()}-cdk-wisaw-fn`,
    retention: logs.RetentionDays.ONE_DAY,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  })

  const wisawFn = new NodejsFunction(
    scope,
    `${deployEnv()}-WiSaw-GraphQlMapFunction-cdk`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: path.join(__dirname, '../../lambda-fns/index.ts'),
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
      logGroup: wisawFnLogGroup,
      memorySize: 10240,
      // memorySize: 3008,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const processUploadedImageLambdaFunctionLogGroup = new logs.LogGroup(scope, `${deployEnv()}_processUploadedImage-LogGroup`, {
    logGroupName: `/aws/lambda/${deployEnv()}-cdk-wisaw-fn-processUploadedImage`, // Assuming default naming or explicit? Wait, the function name is not explicit in the original code?
    // Ah, looking at original code: functionName is NOT specified for processUploadedImageLambdaFunction.
    // If functionName is not specified, CDK generates one.
    // But I need to specify logGroupName to be sure, or let CDK manage it?
    // If I pass logGroup, CDK will use it.
    // But if I want to match existing logs, I need to know the name.
    // The original code didn't specify functionName, so it was auto-generated.
    // Wait, let me check the original code again.
    retention: logs.RetentionDays.ONE_DAY,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  })

  const processUploadedImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processUploadedImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../../lambda-fns/lambdas/processUploadedImage/index.ts'),
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
      logGroup: processUploadedImageLambdaFunctionLogGroup,
      memorySize: 10240,
      // memorySize: 3008,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const processUploadedPrivateImageLambdaFunctionLogGroup = new logs.LogGroup(scope, `${deployEnv()}_processUploadedPrivateImage-LogGroup`, {
    logGroupName: `/aws/lambda/${deployEnv()}-cdk-wisaw-fn-processUploadedPrivateImage`,
    retention: logs.RetentionDays.ONE_DAY,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  })

  const processUploadedPrivateImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processUploadedPrivateImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../../lambda-fns/lambdas/processUploadedPrivateImage/index.ts'),
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
      logGroup: processUploadedPrivateImageLambdaFunctionLogGroup,
      memorySize: 10240,
      // memorySize: 3008,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const processDeletedImageLambdaFunctionLogGroup = new logs.LogGroup(scope, `${deployEnv()}_processDeletedImage-LogGroup`, {
    logGroupName: `/aws/lambda/${deployEnv()}-cdk-wisaw-fn-processDeletedImage`,
    retention: logs.RetentionDays.ONE_DAY,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  })

  const processDeletedImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processDeletedImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: path.join(__dirname, '../../lambda-fns/lambdas/processDeletedImage/index.ts'),
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
      logGroup: processDeletedImageLambdaFunctionLogGroup,
      // memorySize: 10240,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const processDeletedPrivateImageLambdaFunctionLogGroup = new logs.LogGroup(scope, `${deployEnv()}_processDeletedPrivateImage-LogGroup`, {
    logGroupName: `/aws/lambda/${deployEnv()}-cdk-wisaw-fn-processDeletedPrivateImage`,
    retention: logs.RetentionDays.ONE_DAY,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  })

  const processDeletedPrivateImageLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_processDeletedPrivateImage`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: path.join(__dirname, '../../lambda-fns/lambdas/processDeletedPrivateImage/index.ts'),
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
      logGroup: processDeletedPrivateImageLambdaFunctionLogGroup,
      // memorySize: 10240,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const cleanupAbuseReportsLambdaFunctionLogGroup = new logs.LogGroup(scope, `${deployEnv()}_cleaupupAbuseReports-LogGroup`, {
    logGroupName: `/aws/lambda/${deployEnv()}-cdk-wisaw-fn-cleaupupAbuseReports`, // Assuming naming convention
    retention: logs.RetentionDays.ONE_DAY,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  })

  const cleanupAbuseReportsLambdaFunction = new NodejsFunction(
    scope,
    `${deployEnv()}_cleaupupAbuseReports`,
    {
      runtime: lambda.Runtime.NODEJS_22_X,
      // handler: "index.handler",
      entry: path.join(__dirname, '../../lambda-fns/lambdas/cleaupupAbuseReports/index.ts'),
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
      logGroup: cleanupAbuseReportsLambdaFunctionLogGroup,
      // memorySize: 10240,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...config
      }
    }
  )

  const cleanupAbuseReportsLambdaTarget = new LambdaFunction(
    cleanupAbuseReportsLambdaFunction
  )

  // eslint-disable-next-line no-new
  new Rule(scope, `${deployEnv()}_lambda-polling-rule`, {
    description: 'Rule to trigger scheduled lambda',
    // schedule: Schedule.rate(cdk.Duration.minutes(1)),
    schedule: Schedule.rate(cdk.Duration.hours(24)),
    targets: [cleanupAbuseReportsLambdaTarget]
  })

  let generateSiteMapLambdaFunction: NodejsFunction | undefined
  let injectMetaTagsLambdaFunctionPhoto: cloudfront.experimental.EdgeFunction | undefined
  let injectMetaTagsLambdaFunctionVideo: cloudfront.experimental.EdgeFunction | undefined
  let redirectLambdaEdgeFunction: cloudfront.experimental.EdgeFunction | undefined

  if (deployEnv() === 'prod') {
    const generateSiteMapLambdaFunctionLogGroup = new logs.LogGroup(scope, `${deployEnv()}_generateSiteMap-LogGroup`, {
      logGroupName: `/aws/lambda/${deployEnv()}-cdk-wisaw-fn-generateSiteMap`,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    generateSiteMapLambdaFunction = new NodejsFunction(
      scope,
      `${deployEnv()}_generateSiteMap`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(__dirname, '../../lambda-fns/lambdas/generateSiteMap/index.ts'),
        handler: 'main',
        bundling: {
          minify: true,
          target: 'es2020',
          sourceMap: true,
          sourceMapMode: SourceMapMode.INLINE,
          sourcesContent: false
        },
        insightsVersion,
        logGroup: generateSiteMapLambdaFunctionLogGroup,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(30),
        environment: {
          ...config
        }
        // role: lambdaExecutionRole, // Assign the imported role to the Lambda function
      }
    )

    const generateSiteMapLambdaFunctionTarget = new LambdaFunction(
      generateSiteMapLambdaFunction
    )

    // eslint-disable-next-line no-new
    new Rule(scope, 'lambda-polling-rule', {
      description: 'Rule to trigger scheduled lambda',
      schedule: Schedule.rate(cdk.Duration.hours(5)),
      // schedule: Schedule.rate(cdk.Duration.minutes(1)),
      targets: [generateSiteMapLambdaFunctionTarget]
    })

    // lambda@edge function for ingecting OG meta tags on the fly
    const injectMetaTagsLambdaFunctionPhotoLogGroup = new logs.LogGroup(scope, `${deployEnv()}_injectPhotoMetaTagsLambdaFunction_photo-LogGroup`, {
      logGroupName: `/aws/lambda/us-east-1.${deployEnv()}-cdk-injectMetaTagsLambdaFn-photo`, // Edge functions usually have region prefix in log group name if executed in region, but for home region it might be different?
      // Actually, for Edge functions, the logs in us-east-1 are usually at /aws/lambda/us-east-1.<FunctionName>
      // But wait, if I create a LogGroup here, I am creating it in the region where the stack is deployed (us-east-1).
      // The EdgeFunction construct creates the function in us-east-1.
      // The logs for executions in us-east-1 will go to a log group in us-east-1.
      // The name of that log group is /aws/lambda/us-east-1.<FunctionName> ?
      // Or just /aws/lambda/<FunctionName> ?
      // For Lambda@Edge, the function name in CloudFront includes the region? No.
      // Let's check the original code or assumptions.
      // The original code didn't specify functionName for EdgeFunction?
      // Wait, let me check the original code for EdgeFunction.
      // It says: `${deployEnv()}_injectPhotoMetaTagsLambdaFunction_photo` as ID.
      // It does NOT specify functionName.
      // So CDK generates a function name.
      // If I want to manage the log group, I should probably specify the function name explicitly to be sure.
      // But if I specify functionName, I need to be careful about uniqueness.
      // Let's try to specify functionName for EdgeFunction to match what I expect for LogGroup.
      // Or, I can just pass the logGroup and let CDK/Lambda use it.
      // If I pass logGroup to EdgeFunction, does it enforce the name?
      // The `logGroup` prop in FunctionOptions forces the function to use that LogGroup.
      // So I can name the LogGroup whatever I want, and the Lambda will write to it (in the home region).
      // So I don't need to guess the name, I just need to give it a name.
      // But for Edge functions, the logs in OTHER regions are created automatically with name /aws/lambda/us-east-1.<FunctionName>.
      // So if I want consistency, I should probably name my home region log group similarly?
      // Or just let it be.
      // I'll just give it a name that makes sense.
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    injectMetaTagsLambdaFunctionPhoto =
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
          logGroup: injectMetaTagsLambdaFunctionPhotoLogGroup
          // environment: {
          //   ...config,
          // },
        }
      )

    const injectMetaTagsLambdaFunctionVideoLogGroup = new logs.LogGroup(scope, `${deployEnv()}_injectPhotoMetaTagsLambdaFunction_video-LogGroup`, {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    injectMetaTagsLambdaFunctionVideo =
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
          logGroup: injectMetaTagsLambdaFunctionVideoLogGroup
          // environment: {
          //   ...config,
          // },
        }
      )

    const redirectLambdaEdgeFunctionLogGroup = new logs.LogGroup(scope, `${deployEnv()}_redirectLambdaEdgeFunction-LogGroup`, {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

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
          logGroup: redirectLambdaEdgeFunctionLogGroup
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
    cleanupAbuseReportsLambdaFunction,
    generateSiteMapLambdaFunction,
    injectMetaTagsLambdaFunctionPhoto,
    injectMetaTagsLambdaFunctionVideo,
    redirectLambdaEdgeFunction
  }
}
