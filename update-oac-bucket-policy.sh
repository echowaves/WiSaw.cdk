#!/bin/bash

# Update bucket policy script for OAC (Origin Access Control)
# This script helps apply the OAC bucket policy to your S3 bucket using the CloudFront Distribution ID

echo "Updating bucket policy for wisaw.com with Origin Access Control (OAC)..."

# Get CloudFront Distribution ID from user or CDK outputs
if [ -z "$1" ]; then
  echo "Please provide your CloudFront Distribution ID as the first argument"
  echo "Usage: ./update-oac-bucket-policy.sh DISTRIBUTION_ID"
  exit 1
fi

DISTRIBUTION_ID=$1

# Create a temporary policy file with the actual Distribution ID
echo "Creating policy with Distribution ID: $DISTRIBUTION_ID"
sed "s/\[DISTRIBUTION_ID\]/$DISTRIBUTION_ID/g" oac-bucket-policy-template.json > oac-bucket-policy.json

# Apply the bucket policy
echo "Applying OAC bucket policy to wisaw.com..."
aws s3api put-bucket-policy --bucket wisaw.com --policy file://oac-bucket-policy.json

if [ $? -eq 0 ]; then
  echo "✅ OAC bucket policy successfully applied!"
  echo "Now CloudFront will access your S3 bucket using Origin Access Control (OAC)"
  rm oac-bucket-policy.json
else
  echo "❌ Failed to apply the bucket policy. Please check your AWS credentials and permissions."
  echo "The policy file is available at: oac-bucket-policy.json"
fi
