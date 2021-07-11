// import axios from 'axios'
//
// import { exec } from 'child_process'
//
// import Recognition from '../../models/recognition'
//
// import ImageAnalyser from '../recognitions/imageAnalyser'
//
// const stringifyObject = require('stringify-object')

// const fs = require('fs-extra')

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
  // we only want to deal with originals
  console.log(`received image: ${name}`)
  if (name.includes('-thumb')) {
    console.log('thumbnail uploaded, activating image')
    const photoId = name.replace('-thumb', '')
    // activate image
    // const activateUrl = `${process.env.HOST}/photos/${photoId}/activate`
    // console.log({ activateUrl })
  //   await axios.put(activateUrl)
  //
  //   console.log('------------------------ about to call ImageAnalyser')
  //   const metaData = await ImageAnalyser.recognizeImage({
  //     bucket: record.s3.bucket.name,
  //     imageName: photoId,
  //   })
  //   console.log('------------------------ called ImageAnalyser')
  //   console.log(stringifyObject(metaData))
  //
  //   if (metaData) {
  //     await Recognition.destroy({ where: { photoId } })
  //     await Recognition.create({ photoId, metaData })
  //   }
  //
    cb(null, 'activating the image in DB')
    return true
  }

  // download the original to disk

  const s3 = new AWS.S3()

  const image = await s3.getObject({
    Bucket: record.s3.bucket.name,
    Key: record.s3.object.key,
  }).promise()

  const buffer = await sharp(image.Body).webp().resize({height: 300}).toBuffer()

  await s3.putObject({
      Bucket: record.s3.bucket.name,
      Key: `${record.s3.object.key}-thumb`,
      Body: buffer,
      ContentType: 'image',
    }).promise()

  cb(null, 'success everything')
  return true
}
