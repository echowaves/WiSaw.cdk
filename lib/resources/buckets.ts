import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import { Construct } from 'constructs'
import { deployEnv } from '../utilities/config'

export function createBuckets (scope: Construct, lambdas: any): any {
  const {
    wisawFn,
    processUploadedImageLambdaFunction,
    processDeletedImageLambdaFunction,
    processUploadedPrivateImageLambdaFunction,
    processDeletedPrivateImageLambdaFunction,
    generateSiteMapLambdaFunction,
    injectMetaTagsLambdaFunctionPhoto,
    injectMetaTagsLambdaFunctionVideo,
    redirectLambdaEdgeFunction
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

  // ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // imgPrivateBucket
  // Grant access to s3 bucket for lambda function
  const imgPrivateBucket = s3.Bucket.fromBucketName(
    scope,
    `wisaw-img-private-${deployEnv()}`,
    `wisaw-img-private-${deployEnv()}`
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
    { suffix: '.upload' }
  )

  // invoke lambda every time an object is deleted in the bucket
  imgPrivateBucket.addEventNotification(
    s3.EventType.OBJECT_REMOVED,
    new s3n.LambdaDestination(processDeletedPrivateImageLambdaFunction),
    // only invoke lambda if object matches the filter
    // {prefix: 'test/', suffix: '.yaml'},
    { suffix: '-thumb' }
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
  }

  return {
    imgBucket,
    imgPrivateBucket,
    webAppBucket
  }
}
