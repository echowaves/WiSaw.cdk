import sql from '../../sql'

const AWS = require('aws-sdk')

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any, cb: any) {
  const record = event.Records[0]
  const name = record.s3.object.key

  const photoHash = name.replace('-thumb', '')
  // we only want to deal with originals
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting image: ${name}`)
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoHash: ${photoHash}`)

  await Promise.all([
    _deleteUpload({Bucket: record.s3.bucket.name, Key: `${photoHash}`,}),
    _cleanupTables({photoHash,}),
  ])

  cb(null, 'success everything')
  return true
}

const _deleteUpload = async({Bucket, Key,}: {Bucket: string, Key: string}) => {
  try {
    const s3 = new AWS.S3()
    await s3.deleteObject({
      Bucket,
      Key,
    }).promise()
  } catch (err) {
    console.log('Error deleting object')
    console.log({err,})
  }
}

const _cleanupTables = async({photoHash,}: {photoHash: string}) => {
  try {
    const result = (await sql`
                    DELETE from "ChatPhotos"
                    WHERE
                    chatPhotoHash = ${photoHash}
                    `
    )
    //
  } catch (err) {
    console.log('Error ChatPhotos delete')
    console.log({err,})
  }

  try {
    const result = (await sql`
                    DELETE from "Messages"
                    WHERE
                    "chatPhotoHash" = ${photoHash}
                    `
    )
    //
  } catch (err) {
    console.log('Error Messages delete')
    console.log({err,})
  }
}
