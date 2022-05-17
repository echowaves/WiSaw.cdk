// import * as moment from 'moment'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(assetKey: string, contentType: string) {
  const s3 = new AWS.S3()
  const s3Params = {
    Bucket: process.env.S3_BUCKET,
    Key: `${assetKey}`,
    ContentType: contentType,
    Expires: 60 * 60, // expires in 1 minute * 60 minutes, after that request a new URL
    ACL: 'public-read',
  }

  const uploadUrl = s3.getSignedUrl('putObject', s3Params)

  return uploadUrl
}
