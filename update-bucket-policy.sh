#!/bin/bash

# Script to update the bucket policy for wisaw.com

# Get the OAI ID from the CloudFormation output
echo "Getting the Origin Access Identity ID from CloudFormation..."
OAI_ID=$(aws cloudformation describe-stacks --stack-name WiSawCdkStack --query "Stacks[0].Outputs[?OutputKey=='CdnOriginAccessIdentityId'].OutputValue" --output text)

if [ -z "$OAI_ID" ]; then
  echo "Error: Could not retrieve OAI ID from CloudFormation outputs."
  echo "Please make sure you have deployed the stack and have the appropriate AWS CLI credentials."
  exit 1
fi

echo "Found Origin Access Identity ID: $OAI_ID"

# Create the bucket policy JSON file with the OAI ID
echo "Creating bucket policy with OAI ID..."
cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAIAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity $OAI_ID"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::wisaw.com/*"
    }
  ]
}
EOF

echo "Created bucket policy file: bucket-policy.json"

# Apply the policy to the bucket
echo "Applying bucket policy to wisaw.com bucket..."
aws s3api put-bucket-policy --bucket wisaw.com --policy file://bucket-policy.json

if [ $? -eq 0 ]; then
  echo "Successfully updated bucket policy for wisaw.com"
else
  echo "Error: Failed to update bucket policy for wisaw.com"
  echo "Please check your AWS CLI credentials and bucket permissions."
  exit 1
fi

echo "Bucket policy update complete!"
