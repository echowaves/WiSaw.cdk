// import * as moment from 'moment'

import psql from '../../psql'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(uuid: string, photoHash: string, contentType: string) {
  // console.log("generateUploadUrlForMessage:: started")

  const assetKey = `${photoHash}.upload`

  await psql.connect()
  const result =
  (await psql.query(`
  SELECT * FROM "ChatPhotos"
    WHERE
      "chatPhotoHash" = '${photoHash}'
    `)
  ).rows



  // console.log("ChatPhotos", {result,})

  if(result.length === 1) { // the photo with this hash already
    const chatPhoto = result[0]
    if(uuid !== chatPhoto.uuid) {
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


  const s3 = new AWS.S3()
  const s3Params = {
    Bucket: process.env.S3_BUCKET_PRIVATE,
    Key: `${assetKey}`,
    ContentType: contentType,
    Expires: 60 * 60, // expires in 1 minute * 60 minutes, after that request a new URL
    ACL: 'public-read',
  }

  const uploadUrl = s3.getSignedUrl('putObject', s3Params)

  return {
    newAsset: true,
    uploadUrl,
  }
}
