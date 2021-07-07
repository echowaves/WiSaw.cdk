// import * as moment from 'moment'

// import sql from '../../sql'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(photoId: bigint) {
  const s3 = new AWS.S3()
  const s3Params = {
    Bucket: process.env.S3_BUCKET,
    Key: `${photoId}`,
    ContentType: 'image/jpeg',
    Expires: 60, // expires in 1 minute, after that request a new URL
    ACL: 'public-read',
  }

  const uploadUrl = s3.getSignedUrl('putObject', s3Params)

  return uploadUrl
}
