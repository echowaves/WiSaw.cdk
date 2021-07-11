import * as moment from 'moment'

import sql from '../../sql'

const AWS = require('aws-sdk')

const sharp = require('sharp')

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any, cb: any) {
  // // define all the thumbnails that we want
  // const widths = {
  //   300: '-thumbnail x300', // converting to the height of 300
  // }
  //
  const record = event.Records[0];
  const name = record.s3.object.key
  const photoId = name.replace('.upload', '')
  // we only want to deal with originals
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!received image: ${name}`)
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  const s3 = new AWS.S3()

  const image =
    await s3.getObject({
      Bucket: record.s3.bucket.name,
      Key: record.s3.object.key,
    }).promise()

  await _genWebpThumb({image, Bucket: record.s3.bucket.name, Key: `${photoId}-thumb`})
  await _genWebp({image, Bucket: record.s3.bucket.name, Key: `${photoId}`})
  await _recognizeImage({Bucket: record.s3.bucket.name, Name: `${photoId}`})
  await _deleteUpload({ Bucket: record.s3.bucket.name, Key: `${name}`})

  cb(null, 'success everything')
  return true
}

const _genWebpThumb = async({image, Bucket, Key}: {image: any, Bucket: string, Key: string}) => {

  const buffer = await sharp(image.Body).webp().resize({height: 300}).toBuffer()
  const s3 = new AWS.S3()
  await s3.putObject({
      Bucket,
      Key,
      Body: buffer,
      ContentType: 'image',
    }).promise()
}

const _genWebp = async({image, Bucket, Key}: {image: any, Bucket: string, Key: string}) => {

  const buffer = await sharp(image.Body).webp().toBuffer()
  const s3 = new AWS.S3()
  await s3.putObject({
      Bucket,
      Key,
      Body: buffer,
      ContentType: 'image',
    }).promise()

}

const _deleteUpload = async({Bucket, Key}: {Bucket: string, Key: string}) => {
  const s3 = new AWS.S3()
  await s3.deleteObject({
    Bucket,
    Key,
  }).promise()
}

const _recognizeImage = async({Bucket, Name}: {Bucket: string, Name: string}) => {
  const rekognition = new AWS.Rekognition()
  const params = {
    Image: {
      S3Object: {
        Bucket,
        Name,
      },
    },
  }

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


    metaData.Labels = labelsData.Labels
    // console.log(JSON.stringify(labelsData))

    metaData.ModerationLabels = moderationData.ModerationLabels
    // console.log(JSON.stringify(moderationData))

    metaData.TextDetections = textData.TextDetections
    // console.log(JSON.stringify(textData))
  } catch (err) {
    console.log('Error parsing image')
    console.log(err)
  }

  try {
    const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
    const result = (await sql`
                    insert into "Recognitions"
                    (
                        "photoId",
                        "metaData",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      ${Name},
                      ${metaData},
                      ${createdAt},
                      ${createdAt}
                    )
                    returning *
                    `
                  )
} catch (err) {
  console.log('Error saving recognitions')
  console.log(err)
}

}
