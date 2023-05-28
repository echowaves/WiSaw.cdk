const { SitemapStream, streamToPromise } = require("sitemap")

import psql from "../../psql"

import AWS from "aws-sdk"

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any /*, cb: any*/) {
  const smStream = new SitemapStream({ hostname: "https://www.wisaw.com" })
  smStream.write({ url: "/", changefreq: "daily" })

  let photos
  await psql.connect()

  // retrieve photos
  try {
    photos = (
      await psql.query(`  
        SELECT
        *
        FROM "Photos"
        WHERE
            "commentsCount" > 0
        AND
            active = true
      `)
    ).rows
  } catch (err) {
    console.log("Unable to retrieve Photos feed", { err })
    // return false
  }
  await psql.clean()

  // console.log('photos.length:', photos.length)
  photos?.forEach((photo: any) => {
    const jsonObj = JSON.parse(JSON.stringify(photo))
    smStream.write({ url: `/photos/${photo.id}` })
  })
  smStream.end()
  const buffer = await streamToPromise(smStream)

  // download the original to disk
  const s3 = new AWS.S3()

  try {
    // console.log('uploading sitemap.xml')

    await s3
      .putObject({
        ACL: "public-read",
        Key: "sitemap.xml",
        Body: buffer.toString(),
        Bucket: "wisaw-client",
      })
      .promise()

    // console.log('finished uploading')
  } catch (err) {
    console.log("Unable to upload sitemap.xml", { err })
  }

  // console.log('done')

  return true
}
