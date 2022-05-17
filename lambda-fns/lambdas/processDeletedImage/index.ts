import psql from '../../psql'

const AWS = require('aws-sdk')

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any, cb: any) {
  const record = event.Records[0]
  const name = record.s3.object.key

  const photoId = name.replace('-thumb', '')
  // we only want to deal with originals
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting image: ${name}`)
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  await Promise.all([
    _deleteUpload({Bucket: record.s3.bucket.name, Key: `${photoId}`,}),
    _cleanupTables({photoId,}),
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

const _cleanupTables = async({photoId,}: {photoId: string}) => {
  await psql.connect()
  try {
    await psql.query(`
                    DELETE from "Photos"
                    WHERE
                    id = ${photoId}
                    `
    )
    //
  } catch (err) {
    console.log('Error de-activating photo')
    console.log({err,})
  }

  try {
    await psql.query(`
        DELETE from "Watchers"
                    WHERE
                    "photoId" = ${photoId}
                    `
    )
    //
  } catch (err) {
    console.log('Error cleaning up Watchers')
    console.log({err,})
  }

  try {
    await psql.query(`
                    DELETE from "Recognitions"
                    WHERE
                    "photoId" = ${photoId}
                    `
    )
    //
  } catch (err) {
    console.log('Error cleaning up Recognitions')
    console.log({err,})
  }
  await psql.clean()

}
