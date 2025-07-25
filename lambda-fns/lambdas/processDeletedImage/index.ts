import psql from "../../psql"

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  const record = event.Records[0]
  const name = record.s3.object.key
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting name: ${name}`)
  
  try {
  const photoId = name.replace("-thumb", "").replace(".webp", "")
  // we only want to deal with originals
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting image: ${name}`)
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  await Promise.all([
    _deleteUpload({ Bucket: record.s3.bucket.name, Key: `${photoId}` }),
    _cleanupTables({ photoId }),
  ])
  // console.log('everything ended')
  // cb(null, 'success everything')
} catch (err) {
  console.error("Error processing deleted image")
  console.error({ err })  
}
  return true
}

const _deleteUpload = async ({
  Bucket,
  Key,
}: {
  Bucket: string
  Key: string
}) => {
  // console.log(`_deleteUpload started: ${Key}`)

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
  // console.log(`_deleteUpload ended: ${Key}`)
}

const _cleanupTables = async ({ photoId }: { photoId: string }) => {
  // console.log(`_cleanupTables started: ${photoId}`)

  await psql.connect()
  try {
    await psql.query(`
                    DELETE from "Photos"
                    WHERE
                    id = '${photoId}'
                    `)
    //
  } catch (err) {
    console.error("Error de-activating photo")
    console.error({ err })
  }
  // console.log(`_cleanupTables ended 1: ${photoId}`)

  try {
    await psql.query(`
        DELETE from "Watchers"
                    WHERE
                    "photoId" = '${photoId}'
                    `)
    //
  } catch (err) {
    console.error("Error cleaning up Watchers")
    console.error({ err })
  }
  // console.log(`_cleanupTables ended 2: ${photoId}`)


  

  try {
    await psql.query(`
                    DELETE from "Recognitions"
                    WHERE
                    "photoId" = '${photoId}'
                    `)
    //
  } catch (err) {
    console.error("Error cleaning up Recognitions")
    console.error({ err })
  }
  // console.log(`_cleanupTables ended 3: ${photoId}`)

    try {
    await psql.query(`
                    DELETE from "Comments"
                    WHERE
                    "photoId" = '${photoId}'
                    `)
    //
  } catch (err) {
    console.error("Error cleaning up Comments")
    console.error({ err })
  }
  // console.log(`_cleanupTables ended 3: ${photoId}`)

  await psql.clean()
  // console.log(`_cleanupTables ended: ${photoId}`)
}
