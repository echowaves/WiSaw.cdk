import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs'
import { deployEnv } from '../utilities/config'

export function createCloudFront (scope: Construct, buckets: any, lambdas: any): void {
  if (deployEnv() !== 'prod') {
    return
  }

  const { webAppBucket, imgBucket } = buckets
  const {
    injectMetaTagsLambdaFunction_photo,
    injectMetaTagsLambdaFunction_video,
    redirectLambdaEdgeFunction
  } = lambdas

  // Use the ACM certificate
  const cert = acm.Certificate.fromCertificateArn(
    scope,
    'my_cert',
    'arn:aws:acm:us-east-1:963958500685:certificate/ef907dfb-ee52-4802-bcb8-6eead57c124b'
  )

  // Use the ACM certificate
  const imgCert = acm.Certificate.fromCertificateArn(
    scope,
    'img_cert',
    'arn:aws:acm:us-east-1:963958500685:certificate/538e85e0-39f4-4d34-8580-86e8729e2c3c'
  )

  // Create cache policies
  const basicCachePolicy = new cloudfront.CachePolicy(scope, 'BasicCachePolicy', {
    defaultTtl: cdk.Duration.days(10),
    minTtl: cdk.Duration.days(10),
    maxTtl: cdk.Duration.days(10),
    enableAcceptEncodingGzip: true,
    enableAcceptEncodingBrotli: true,
    queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
    cookieBehavior: cloudfront.CacheCookieBehavior.all()
  })

  // Create origin request policy that forwards all cookies and query strings
  const allForwardPolicy = new cloudfront.OriginRequestPolicy(scope, 'AllForwardPolicy', {
    cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
    queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    headerBehavior: cloudfront.OriginRequestHeaderBehavior.none()
  })

  // Create the CloudFront distribution with S3 as an origin
  const distribution = new cloudfront.Distribution(scope, 'wisaw-distro', {
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
          includeBody: true
        }
      ]
    },
    additionalBehaviors: {
      'photos/*': {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: basicCachePolicy,
        originRequestPolicy: allForwardPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
        edgeLambdas: [
          {
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: injectMetaTagsLambdaFunction_photo.currentVersion,
            includeBody: true
          },
          {
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
            functionVersion: redirectLambdaEdgeFunction.currentVersion,
            includeBody: true
          }

        ]
      },
      'videos/*': {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: basicCachePolicy,
        originRequestPolicy: allForwardPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
        edgeLambdas: [
          {
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: injectMetaTagsLambdaFunction_video.currentVersion,
            includeBody: true
          },
          {
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
            functionVersion: redirectLambdaEdgeFunction.currentVersion,
            includeBody: true
          }
        ]
      }
    },
    certificate: cert,
    domainNames: ['www.wisaw.com', 'wisaw.com', 'link.wisaw.com'],
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 200,
        ttl: cdk.Duration.days(365),
        responsePagePath: '/index.html'
      },
      {
        httpStatus: 404,
        responseHttpStatus: 200,
        ttl: cdk.Duration.days(365),
        responsePagePath: '/index.html'
      }
    ]
  })

  // Output the Distribution ID to use in the OAC bucket policy
  // eslint-disable-next-line no-new
  new cdk.CfnOutput(scope, 'CloudFrontDistributionId', {
    value: distribution.distributionId,
    description: 'Use this Distribution ID in the OAC bucket policy for wisaw.com'
  })

  // Create the CloudFront distribution with S3 as an origin for images
  const imgDistribution = new cloudfront.Distribution(scope, 'wisaw-img-distro', {
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    defaultBehavior: {
      origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(imgBucket),
      compress: true,
      cachePolicy: basicCachePolicy,
      originRequestPolicy: allForwardPolicy,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
      edgeLambdas: [
        // {
        //   eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
        //   functionVersion: imgRedirectLambdaEdgeFunction.currentVersion,
        //   includeBody: true,
        // },
      ]

    },
    additionalBehaviors: {

    },
    certificate: imgCert,
    domainNames: ['img.wisaw.com'],
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 200,
        ttl: cdk.Duration.days(365),
        responsePagePath: '/index.html'
      },
      {
        httpStatus: 404,
        responseHttpStatus: 200,
        ttl: cdk.Duration.days(365),
        responsePagePath: '/index.html'
      }
    ]
  })

  // Output the Distribution ID to use in the OAC bucket policy
  // eslint-disable-next-line no-new
  new cdk.CfnOutput(scope, 'ImgCloudFrontDistributionId', {
    value: imgDistribution.distributionId,
    description: 'Use this Distribution ID in the OAC bucket policy for img.wisaw.com'
  })
}
