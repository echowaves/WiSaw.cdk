import psql from "../../psql"

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"


const sharp = require("sharp")

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  // // define all the thumbnails that we want
  // const widths = {
  //   300: '-thumbnail x300', // converting to the height of 300
  // }
  //
  const record = event.Records[0]
  const name = record.s3.object.key
  const photoHash = name.replace(".upload", "")
  const Bucket = record.s3.bucket.name
  // we only want to deal with originals
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!received image: ${name}`)
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoHash: ${photoHash}`)

  const client = new S3Client({region: 'us-east-1' })

  const input = 
  {
    Bucket,
    Key: name,
  
};

const command = new GetObjectCommand(input);
const image = await client.send(command);

  // console.log({image,})

  await Promise.all([
    _genWebpThumb({ image, Bucket, Key: `${photoHash}-thumb` }),
    _genWebp({ image, Bucket, Key: `${photoHash}` }),
  ])

  await Promise.all([
    _deleteUpload({ Bucket, Key: name }),
    _activatePhoto({ photoHash }),
  ])

  // cb(null, 'success everything')
  return true
}

const _genWebpThumb = async ({
  image,
  Bucket,
  Key,
}: {
  image: any
  Bucket: string
  Key: string
}) => {
  const buffer = await sharp(image.Body)
    .rotate()
    .webp({ lossless: false, quality: 90 })
    .resize({ height: 300 })
    .toBuffer()

    const putCommand = new PutObjectCommand({
      Bucket,
      Key,
      Body: buffer,
      ContentType: "image/webp",
      ACL: "public-read",
      CacheControl: "max-age=31536000",
    })

    const client = new S3Client({region: 'us-east-1' })

    await client.send(putCommand)

  
}

const _genWebp = async ({
  image,
  Bucket,
  Key,
}: {
  image: any
  Bucket: string
  Key: string
}) => {
  const buffer = await sharp(image.Body)
    .rotate()
    .webp({ lossless: false, quality: 90 })
    .toBuffer()
    const putCommand = new PutObjectCommand({
      Bucket,
      Key,
      Body: buffer,
      ContentType: "image/webp",
      ACL: "public-read",
      CacheControl: "max-age=31536000",
    })

    const client = new S3Client({region: 'us-east-1' })

    await client.send(putCommand)
}

const _deleteUpload = async ({
  Bucket,
  Key,
}: {
  Bucket: string
  Key: string
}) => {
  const deleteCommand = new DeleteObjectCommand({
    Bucket,
    Key,
  })

  const client = new S3Client({region: 'us-east-1' })

  await client.send(deleteCommand)

}

const _activatePhoto = async ({ photoHash }: { photoHash: string }) => {
  // console.log("_activatePhoto::", "start")

  try {
    await psql.connect()
    const result = (
      await psql.query(`  
    SELECT * FROM "Messages"
    WHERE
      "chatPhotoHash" = '${photoHash}'
    `)
    ).rows
    // console.log("_activatePhoto::", {result,})

    if (result.length === 1) {
      // the photo with this hash already
      const chatPhoto = result[0]
      await psql.query(`  
                      INSERT INTO "ChatPhotos"
                    (
                        "uuid",
                        "chatPhotoHash"
                    ) values (
                      '${chatPhoto.uuid}',
                      '${photoHash}'
                    )
                    returning *
                    `)
    }
    // console.log({result})
  } catch (err) {
    console.log("Error activating photo")
    console.log({ err })
  }
  await psql.clean()

  // console.log("_activatePhoto::", "end")
}
