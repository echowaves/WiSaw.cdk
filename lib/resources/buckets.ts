import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import { Construct } from 'constructs'
import { config, deployEnv } from '../utilities/config'

export function createBuckets (scope: Construct, lambdas: any): any {
  const {
    wisawFn,
    processUploadedImageLambdaFunction,
    processDeletedImageLambdaFunction,
    generateSiteMapLambdaFunction,
    injectMetaTagsLambdaFunctionPhoto,
    injectMetaTagsLambdaFunctionVideo,
    redirectLambdaEdgeFunction,
    injectStaticMetaTagsLambdaFunction
  } = lambdas

  // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // imgBucket
  // Grant access to s3 bucket for lambda function
  const imgBucket = s3.Bucket.fromBucketName(
    scope,
    `wisaw-img-${deployEnv()}`,
    `wisaw-img-${deployEnv()}`
  )
  imgBucket.grantPut(wisawFn)
  imgBucket.grantPutAcl(wisawFn)
  imgBucket.grantReadWrite(wisawFn)
  imgBucket.grantReadWrite(processUploadedImageLambdaFunction)
  imgBucket.grantPut(processUploadedImageLambdaFunction)
  imgBucket.grantPutAcl(processUploadedImageLambdaFunction)
  imgBucket.grantDelete(processUploadedImageLambdaFunction)

  imgBucket.grantDelete(processDeletedImageLambdaFunction)

  // deletePhoto purges the photo's objects and invalidates their public CDN paths after the
  // soft delete (lambda-fns/controllers/photos/delete.ts). The invalidation is scoped to the
  // single distribution named in config; environments with no id configured get no CloudFront
  // permission at all, and deletePhoto skips the invalidation call for them.
  const cdnDistributionId = String(config.CLOUD_FRONT_DISTRIBUTION ?? '').trim()
  if (cdnDistributionId !== '') {
    wisawFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::${cdk.Stack.of(scope).account}:distribution/${cdnDistributionId}`]
    }))
  }

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
    { suffix: '.upload' }
  )

  // invoke lambda every time an object is deleted in the bucket
  imgBucket.addEventNotification(
    s3.EventType.OBJECT_REMOVED,
    new s3n.LambdaDestination(processDeletedImageLambdaFunction),
    // only invoke lambda if object matches the filter
    // {prefix: 'test/', suffix: '.yaml'},
    { suffix: '-thumb.webp' }
  )

  let webAppBucket: s3.IBucket | undefined

  if (deployEnv() === 'prod') {
    webAppBucket = s3.Bucket.fromBucketName(
      scope,
      'wisaw.com',
      'wisaw.com'
    )

    // Grant the Lambda function permissions to read and write to the S3 bucket
    if (generateSiteMapLambdaFunction !== undefined) {
      webAppBucket.grantReadWrite(generateSiteMapLambdaFunction)
      // It also publishes the seo/<id>.json sidecars the edge injector reads from the media
      // bucket, which is where the media objects they describe live.
      imgBucket.grantReadWrite(generateSiteMapLambdaFunction)
    }

    if (injectMetaTagsLambdaFunctionPhoto !== undefined) {
      webAppBucket.grantRead(injectMetaTagsLambdaFunctionPhoto)
      imgBucket.grantReadWrite(injectMetaTagsLambdaFunctionPhoto)
    }

    if (injectMetaTagsLambdaFunctionVideo !== undefined) {
      webAppBucket.grantRead(injectMetaTagsLambdaFunctionVideo)
      imgBucket.grantReadWrite(injectMetaTagsLambdaFunctionVideo)
    }

    if (redirectLambdaEdgeFunction !== undefined) {
      webAppBucket.grantRead(redirectLambdaEdgeFunction)
    }

    // The static-route injector only reads the app shell out of the web bucket.
    if (injectStaticMetaTagsLambdaFunction !== undefined) {
      webAppBucket.grantRead(injectStaticMetaTagsLambdaFunction)
    }
  }

  return {
    imgBucket,
    webAppBucket
  }
}
