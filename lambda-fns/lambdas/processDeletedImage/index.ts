import psql from '../../psql'

const AWS = require('aws-sdk')

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  const record = event.Records[0]
  const name = record.s3.object.key

  const photoId = name.replace('-thumb', '')
  // we only want to deal with originals
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting image: ${name}`)
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  await Promise.all([
    _deleteUpload({Bucket: record.s3.bucket.name, Key: `${photoId}`,}),
    _cleanupTables({photoId,}),
  ])
  // console.log('everything ended')
  // cb(null, 'success everything')
  return true
}

const _deleteUpload = async({Bucket, Key,}: {Bucket: string, Key: string}) => {
  // console.log(`_deleteUpload started: ${Key}`)

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
  // console.log(`_deleteUpload ended: ${Key}`)

}

const _cleanupTables = async({photoId,}: {photoId: string}) => {
  // console.log(`_cleanupTables started: ${photoId}`)

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
  // console.log(`_cleanupTables ended 1: ${photoId}`)

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
  // console.log(`_cleanupTables ended 2: ${photoId}`)

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
  // console.log(`_cleanupTables ended 3: ${photoId}`)

  await psql.clean()
  // console.log(`_cleanupTables ended: ${photoId}`)

}
