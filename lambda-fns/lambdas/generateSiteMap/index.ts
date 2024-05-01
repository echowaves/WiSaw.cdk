const { SitemapStream, streamToPromise } = require("sitemap")

import psql from "../../psql"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"; // ES Modules import


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
    console.error("Unable to retrieve Photos feed", { err })
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
  
  try {
    // console.log('uploading sitemap.xml')

      const client = new S3Client({region: 'us-east-1' });

      const input = {
        // ACL: "public-read",
        Key: "sitemap.xml",
        Body: buffer.toString(),
        Bucket: "wisaw-client",
      };

      const command = new PutObjectCommand(input);
      const response = await client.send(command);

    // console.log('finished uploading')
  } catch (err) {
    console.error("Unable to upload sitemap.xml", { err })
  }

  // console.log('done')

  return true
}
