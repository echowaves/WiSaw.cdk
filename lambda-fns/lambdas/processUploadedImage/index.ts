import * as moment from 'moment'

import psql from '../../psql'

const AWS = require('aws-sdk')

const sharp = require('sharp')

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  // // define all the thumbnails that we want
  // const widths = {
  //   300: '-thumbnail x300', // converting to the height of 300
  // }
  //
  const record = event.Records[0]
  const name = record.s3.object.key
  const photoId = name.replace('.upload', '')
  const Bucket = record.s3.bucket.name
  // we only want to deal with originals
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!received image: ${name}`)
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  const s3 = new AWS.S3()
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 1    photoId: ${photoId}`)

  let image =
    await s3.getObject({
      Bucket,
      Key: name,
    }).promise()
    // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 2    photoId: ${photoId}`)

  await Promise.all([
    _genWebpThumb({image, Bucket, Key: `${photoId}-thumb`,}),
    _genWebp({image, Bucket, Key: `${photoId}`,}),
    _recognizeImage({Bucket, Key: `${name}`,}),
  ])

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 3    photoId: ${photoId}`)

  await Promise.all([
    _deleteUpload({Bucket, Key: name,}),
    _activatePhoto({photoId,}),
  ])

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 4   photoId: ${photoId}`)

  // cb(null, 'success everything')
  return true
}

const _genWebpThumb = async({image, Bucket, Key,}: {image: any, Bucket: string, Key: string}) => {
// console.log(`_genWebpThumb started  ${Key}`)
  const buffer = await sharp(image.Body).rotate().webp({lossless: false, quality: 80,}).resize({height: 300,}).toBuffer()
  const s3 = new AWS.S3()
  await s3.putObject({
    Bucket,
    Key,
    Body: buffer,
    ContentType: 'image/webp',
    ACL: 'public-read',
    CacheControl: 'max-age=31536000',
  }).promise()

  // console.log(`_genWebpThumb ended  ${Key}`)
}

const _genWebp = async({image, Bucket, Key,}: {image: any, Bucket: string, Key: string}) => {
  // console.log(`_genWebp started  ${Key}`)

  const buffer = await sharp(image.Body).rotate().webp({lossless: false, quality: 90,}).toBuffer()
  const s3 = new AWS.S3()
  await s3.putObject({
    Bucket,
    Key,
    Body: buffer,
    ContentType: 'image/webp',
    ACL: 'public-read',
    CacheControl: 'max-age=31536000',
  }).promise()
  // console.log(`_genWebp ended  ${Key}`)
}

const _deleteUpload = async({Bucket, Key,}: {Bucket: string, Key: string}) => {
  // console.log(`_deleteUpload started  ${Key}`)

  const s3 = new AWS.S3()
  await s3.deleteObject({
    Bucket,
    Key,
  }).promise()
  // console.log(`_deleteUpload ended  ${Key}`)
}

const _recognizeImage = async({Bucket, Key,}: {Bucket: string, Key: string}) => {
  // console.log(`_recognizeImage started  ${Key}`)

  // console.log({Bucket, Key})
  const rekognition = new AWS.Rekognition()
  const params = {
    Image: {
      S3Object: {
        Bucket,
        Name: Key,
      },
    },
  }
  // console.log(`_recognizeImage ended 1  ${Key}`)

  const metaData = {
    Labels: null,
    TextDetections: null,
    ModerationLabels: null,
  }
  try {
    const [
      labelsData,
      moderationData,
      textData,
    ] =
      await Promise.all([
        rekognition.detectLabels(params).promise(),
        rekognition.detectModerationLabels(params).promise(),
        rekognition.detectText(params).promise(),
      ])

      // console.log(`_recognizeImage ended 2  ${Key}`)

    metaData.Labels = labelsData.Labels
    // console.log(JSON.stringify(labelsData))

    metaData.ModerationLabels = moderationData.ModerationLabels
    // console.log(JSON.stringify(moderationData))

    metaData.TextDetections = textData.TextDetections
    // console.log(JSON.stringify(textData))

    // console.log(JSON.stringify(metaData))
  } catch (err) {
    console.log('Error parsing image')
    console.log({err,})
  }
  // console.log(`_recognizeImage ended 3  ${Key}`)

  try {
    const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

    // console.log({metaData: JSON.stringify(metaData),})
    await psql.connect()
    // const result =
    // (
    await psql.query(`    
                  insert into "Recognitions"
                    (
                        "photoId",
                        "metaData",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      $1,
                      $2,
                      $3,
                      $4
                    )
                    returning *
                    `,
    [
      Key.replace('.upload', ''),
      metaData,
      createdAt,
      createdAt,
    ])
    // ).rows
    // console.log({result})
  } catch (err) {
    console.log('Error saving recognitions')
    console.log({err,})
  }
  await psql.clean()
  // console.log(`_recognizeImage ended 4  ${Key}`)

}


const _activatePhoto = async({photoId,}: {photoId: string}) => {
  // console.log(`_activatePhoto started  ${photoId}`)

  try {
    const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

    await psql.connect()
    await psql.query(`    
                    UPDATE "Photos"
                    set active = true, "updatedAt" = '${updatedAt}'
                    WHERE
                    id = ${photoId}
                    `)
    // console.log({result})
  } catch (err) {
    console.log('Error activating photo')
    console.log({err,})
  }
  await psql.clean()
  // console.log(`_activatePhoto ended  ${photoId}`)

}

