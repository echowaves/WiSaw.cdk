# Manually Updating S3 Bucket Policy for CloudFront Access

This guide provides step-by-step instructions for manually updating the bucket policy for the `wisaw.com` S3 bucket to allow access from your CloudFront distribution.

## Option 1: Using the Automated Script

We've provided a script that automatically updates the bucket policy for you:

1. Deploy your CDK stack if you haven't already:
   ```
   cdk deploy
   ```

2. Run the update script:
   ```
   ./update-bucket-policy.sh
   ```

## Option 2: Manual Update via AWS Console

If you prefer to update the bucket policy manually:

1. Deploy your CDK stack and note the `CdnOriginAccessIdentityId` output value.

2. Log in to the AWS Management Console.

3. Navigate to the S3 service.

4. Find and click on the `wisaw.com` bucket.

5. Click on the "Permissions" tab.

6. Scroll down to "Bucket policy" and click "Edit".

7. Use the policy template below, replacing `[OAI_ID]` with the actual Origin Access Identity ID from your stack output:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAIAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity [OAI_ID]"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::wisaw.com/*"
    }
  ]
}
```

8. Click "Save changes".

## Option 3: Manual Update via AWS CLI

You can also update the bucket policy using the AWS CLI:

1. Deploy your CDK stack and get the `CdnOriginAccessIdentityId` output value:
   ```
   aws cloudformation describe-stacks --stack-name WiSawCdkStack --query "Stacks[0].Outputs[?OutputKey=='CdnOriginAccessIdentityId'].OutputValue" --output text
   ```

2. Create a file named `bucket-policy.json` with the policy contents, replacing `[OAI_ID]` with the actual ID from step 1.

3. Apply the policy to the bucket:
   ```
   aws s3api put-bucket-policy --bucket wisaw.com --policy file://bucket-policy.json
   ```

## Verifying the Update

After updating the bucket policy, you can verify it worked by:

1. Testing your CloudFront distribution by accessing it via its domain name
2. Checking that files from the S3 bucket are accessible through CloudFront
3. Viewing the bucket policy in the AWS Console to confirm it was applied correctly

## Troubleshooting

If you encounter any issues:

- Ensure that the OAI ID is correct and properly formatted in the policy
- Verify you have permission to modify the bucket policy
- Check that the bucket name is correct in both the policy Resource and the AWS CLI command
