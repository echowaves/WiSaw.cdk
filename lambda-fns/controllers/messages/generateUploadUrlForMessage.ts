import psql from "../../psql"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// import AbuseReport from '../../models/abuseReport'

export default async function main(
  uuid: string,
  photoHash: string,
  contentType: string,
) {
  // console.log("generateUploadUrlForMessage:: started")

  const assetKey = `${photoHash}.upload`

  await psql.connect()
  const result = (
    await psql.query(`
  SELECT * FROM "ChatPhotos"
    WHERE
      "chatPhotoHash" = '${photoHash}'
    `)
  ).rows
  await psql.clean()

  // console.log("ChatPhotos", {result,})

  if (result.length === 1) {
    // the photo with this hash already
    const chatPhoto = result[0]
    if (uuid !== chatPhoto.uuid) {
      throw "The asset already uploaded from a different device"
    }
    return {
      newAsset: false,
      uploadUrl: null,
    }
  }

  // will intert the record after the image is uploaded
  // const chatPhoto = (await sql`
  //                   INSERT INTO "ChatPhotos"
  //                   (
  //                       "uuid",
  //                       "chatPhotoHash",
  //                   ) values (
  //                     ${uuid},
  //                     ${photoHash}
  //                   )
  //                   returning *
  //                   `
  // )[0]

  
  
  const s3Params = {
    Bucket: process.env.S3_BUCKET_PRIVATE,
    Key: `${assetKey}`,
    ContentType: contentType,
    // Expires: 60 * 60, // expires in 1 minute * 60 minutes, after that request a new URL
    ACL: "public-read",
  }

  const client = new S3Client({region: 'us-east-1' })
  const command = new PutObjectCommand(s3Params)

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

  // const uploadUrl = await getSignedUrl(s3, new PutObjectCommand(s3Params), {
  //   expiresIn: "/* add value from 'Expires' from v2 call if present, else remove */",
  // })

  return {
    newAsset: true,
    uploadUrl,
  }
}
