import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// import AbuseReport from '../../models/abuseReport'

export default async function main(assetKey: string, contentType: string) {
  const s3Params = {
    Bucket: process.env.S3_BUCKET,
    Key: `${assetKey}`,
    ContentType: contentType,
    // Expires: 60 * 60, // expires in 1 minute * 60 minutes, after that request a new URL
    // ACL: "public-read",    
  }

  // const putObjectParams = {
  //   Body: `${assetKey}`,
  //   Bucket: process.env.S3_BUCKET,
  //   Key: `${assetKey}`,
  //   }
    
  // const uploadUrl = s3.getSignedUrl("putObject", s3Params)


  const client = new S3Client({region: 'us-east-1' })
  const command = new PutObjectCommand(s3Params)

  const url = await getSignedUrl(client, command, { expiresIn: 3600 })

  return url
}
 