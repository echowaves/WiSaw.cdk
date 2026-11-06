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
    injectMetaTagsLambdaFunctionPhoto,
    injectMetaTagsLambdaFunctionVideo,
    redirectLambdaEdgeFunction,
    injectStaticMetaTagsLambdaFunction
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

  // HTML cache policy. The 10-day floor on basicCachePolicy overrode every Cache-Control
  // header the edge injector set: a photo page was served with `max-age=100` while really
  // staying in CloudFront for 10 days (observed live as age: 425 on a max-age=100 body), so
  // fixes took days to reach Googlebot. minTtl 0 lets the response header decide, and
  // ignoring cookies/query strings stops ?utm_source=… or any cookie from minting a separate
  // cache entry - and therefore a separate Lambda@Edge invocation - per visitor.
  const htmlCachePolicy = new cloudfront.CachePolicy(scope, 'HtmlCachePolicy', {
    defaultTtl: cdk.Duration.seconds(60),
    minTtl: cdk.Duration.seconds(0),
    maxTtl: cdk.Duration.hours(24),
    enableAcceptEncodingGzip: true,
    enableAcceptEncodingBrotli: true,
    queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    cookieBehavior: cloudfront.CacheCookieBehavior.none()
  })

  // Hashed Vite bundles never change name without changing content, so they can stay pinned.
  const assetsCachePolicy = new cloudfront.CachePolicy(scope, 'AssetsCachePolicy', {
    defaultTtl: cdk.Duration.days(365),
    minTtl: cdk.Duration.days(365),
    maxTtl: cdk.Duration.days(365),
    enableAcceptEncodingGzip: true,
    enableAcceptEncodingBrotli: true,
    queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    cookieBehavior: cloudfront.CacheCookieBehavior.none()
  })

  // robots.txt and sitemap.xml must be re-fetched soon after the generator runs.
  const discoveryCachePolicy = new cloudfront.CachePolicy(scope, 'DiscoveryCachePolicy', {
    defaultTtl: cdk.Duration.seconds(300),
    minTtl: cdk.Duration.seconds(0),
    maxTtl: cdk.Duration.hours(1),
    enableAcceptEncodingGzip: true,
    enableAcceptEncodingBrotli: true,
    queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
    cookieBehavior: cloudfront.CacheCookieBehavior.none()
  })

  // Create origin request policy that forwards all cookies and query strings
  const allForwardPolicy = new cloudfront.OriginRequestPolicy(scope, 'AllForwardPolicy', {
    cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
    queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    headerBehavior: cloudfront.OriginRequestHeaderBehavior.none()
  })

  // HTML never needs cookies or query strings at the origin; forwarding them only widens
  // the cache key and leaks visitor data into origin logs.
  const htmlForwardPolicy = new cloudfront.OriginRequestPolicy(scope, 'HtmlForwardPolicy', {
    cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.none(),
    headerBehavior: cloudfront.OriginRequestHeaderBehavior.none()
  })

  // Create the CloudFront distribution with S3 as an origin
  const distribution = new cloudfront.Distribution(scope, 'wisaw-distro', {
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    // Without a default root object, GET / asks S3 for the key "/" which does not exist, so
    // every homepage response (and Google's canonical target) came back through the custom
    // error path - live check showed `x-cache: Error from cloudfront` on wisaw.com/.
    defaultRootObject: '/index.html',
    defaultBehavior: {
      origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
      compress: true,
      cachePolicy: htmlCachePolicy,
      originRequestPolicy: htmlForwardPolicy,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
      edgeLambdas: [
        {
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          functionVersion: redirectLambdaEdgeFunction.currentVersion,
          includeBody: true
        },
        // Injects the per-route <title>, description and canonical for / , /about,
        // /contact, /terms and /search, and passes anything else through untouched.
        {
          eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
          functionVersion: injectStaticMetaTagsLambdaFunction.currentVersion,
          includeBody: false
        }
      ]
    },
    additionalBehaviors: {
      'photos/*': {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: htmlCachePolicy,
        originRequestPolicy: htmlForwardPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
        edgeLambdas: [
          {
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: injectMetaTagsLambdaFunctionPhoto.currentVersion,
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
        cachePolicy: htmlCachePolicy,
        originRequestPolicy: htmlForwardPolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Add this line
        edgeLambdas: [
          {
            eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            functionVersion: injectMetaTagsLambdaFunctionVideo.currentVersion,
            includeBody: true
          },
          {
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
            functionVersion: redirectLambdaEdgeFunction.currentVersion,
            includeBody: true
          }
        ]
      },
      // Hashed bundles are content-addressed, so they never need the injector or a short
      // TTL. Keeping them out of the default behavior also keeps every script and stylesheet
      // request from invoking a Lambda@Edge function.
      'assets/*': {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
        compress: true,
        cachePolicy: assetsCachePolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      // Google re-reads these on its own schedule; a 10-day TTL here is why the sitemap
      // stayed stale for days after each regeneration.
      'sitemap.xml': {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
        compress: true,
        cachePolicy: discoveryCachePolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      'robots.txt': {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(webAppBucket),
        compress: true,
        cachePolicy: discoveryCachePolicy,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      }
    },
    certificate: cert,
    domainNames: ['www.wisaw.com', 'wisaw.com', 'link.wisaw.com'],
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    // These rewrites were the soft-404 source: every missing object answered HTTP 200 with
    // index.html for a year. That made deleted photos look like live near-duplicate content,
    // made /definitely-not-a-page indexable, and turned a missing hashed bundle into an HTML
    // body that a module script refuses to execute ("React never initializes"). The status is
    // now preserved; only the page is custom.
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: cdk.Duration.minutes(5)
      },
      {
        httpStatus: 404,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: cdk.Duration.minutes(5)
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
    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021
    // No custom error responses here on purpose. Rewriting them to 200 + index.html made a
    // missing image answer with HTML, so Google Image Search received a webpage for a broken
    // .webp URL and the SPA's <img> error handler never fired. A missing object must fail as
    // an object miss.
  })

  // Output the Distribution ID to use in the OAC bucket policy
  // eslint-disable-next-line no-new
  new cdk.CfnOutput(scope, 'ImgCloudFrontDistributionId', {
    value: imgDistribution.distributionId,
    description: 'Use this Distribution ID in the OAC bucket policy for img.wisaw.com'
  })
}
