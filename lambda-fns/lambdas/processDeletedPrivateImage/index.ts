import psql from "../../psql"

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  const record = event.Records[0]
  const name = record.s3.object.key

  const photoHash = name.replace("-thumb", "")
  // we only want to deal with originals
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting image: ${name}`)
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoHash: ${photoHash}`)

  await Promise.all([
    _deleteUpload({ Bucket: record.s3.bucket.name, Key: `${photoHash}` }),
    _cleanupTables({ photoHash }),
  ])

  // cb(null, 'success everything')
  return true
}

const _deleteUpload = async ({
  Bucket,
  Key,
}: {
  Bucket: string
  Key: string
}) => {
  try {
    const deleteCommand = new DeleteObjectCommand({
      Bucket,
      Key,
    })

    const client = new S3Client({region: 'us-east-1' })

    await client.send(deleteCommand)

  } catch (err) {
    console.error("Error deleting object")
    console.error({ err })
  }
}

const _cleanupTables = async ({ photoHash }: { photoHash: string }) => {
  await psql.connect()
  try {
    await psql.query(`
                    DELETE from "ChatPhotos"
                    WHERE
                    "chatPhotoHash" = '${photoHash}'
                    `)
    //
  } catch (err) {
    console.error("Error ChatPhotos delete")
    console.error({ err })
  }

  try {
    await psql.query(`
                    DELETE from "Messages"
                    WHERE
                    "chatPhotoHash" = '${photoHash}'
                    `)
    //
  } catch (err) {
    console.error("Error Messages delete")
    console.error({ err })
  }
  await psql.clean()
}
