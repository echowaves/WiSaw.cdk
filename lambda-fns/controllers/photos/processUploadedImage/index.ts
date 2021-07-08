// import fs from 'fs'
// import AWS from 'aws-sdk'
// import axios from 'axios'
//
// import { exec } from 'child_process'
//
// import Recognition from '../../models/recognition'
//
// import ImageAnalyser from '../recognitions/imageAnalyser'
//
// const stringifyObject = require('stringify-object')

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any, cb: any) {
  console.log('function triggered')
  // // define all the thumbnails that we want
  // const widths = {
  //   300: '-thumbnail x300', // converting to the height of 300
  // }
  //
  // const record = event.Records[0];
  // const name = record.s3.object.key
  // // we only want to deal with originals
  // console.log(`received image: ${name}`)
  // if (name.includes('-thumb')) {
  //   console.log('thumbnail uploaded, activating image')
  //   const photoId = name.replace('-thumb', '')
  //   // activate image
  //   const activateUrl = `${process.env.HOST}/photos/${photoId}/activate`
  //   console.log({ activateUrl })
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
  //   cb(null, 'activating the image in DB')
  //   return true
  // }
  //
  // // get the prefix, and get the hash
  //
  // console.log('record.s3.bucket.name:', record.s3.bucket.name)
  // console.log('record.s3.object.key:', record.s3.object.key)
  // // download the original to disk
  // const s3 = new AWS.S3()
  // const sourcePath = `/tmp/${name}`
  // const targetStream = fs.createWriteStream(sourcePath)
  // const fileStream = s3.getObject({
  //   Bucket: record.s3.bucket.name,
  //   Key: record.s3.object.key,
  // }).createReadStream()
  // fileStream.pipe(targetStream)
  //
  // // when file is downloaded, start processing
  // fileStream.on('end', () => {
  //   // resize to every configured size
  //   Object.keys(widths).forEach((size) => {
  //     const tmpFileName = `/tmp/${name}-thumb-${size}`
  //     const cmd = `convert -auto-orient ${widths[size]} ${sourcePath} ${tmpFileName}`
  //     console.log('Running: ', cmd)
  //
  //     exec(cmd, (error, stdout, stderr) => { // eslint-disable-line no-unused-vars
  //       if (error) {
  //         // the command failed (non-zero), fail
  //         console.warn(`exec error: ${error}, stdout, stderr`)
  //         cb('failed converting')
  //         return false
  //       }
  //       // resize was succesfull, upload the file
  //       console.info(`Resize to ${size} OK`)
  //       const fileBuffer = fs.readFileSync(tmpFileName)
  //       console.log('thumb size:', fileBuffer.byteLength)
  //
  //       try {
  //         console.log('uploading image: ', `${name}-thumb`)
  //         // await s3.putObject({
  //         //   ACL: 'public-read',
  //         //   Key: `${name}-thumb`,
  //         //   Body: fileBuffer,
  //         //   Bucket: record.s3.bucket.name,
  //         //   ContentType: 'image/jpeg',
  //         // })
  //
  //         s3.putObject({
  //           ACL: 'public-read',
  //           Key: `${name}-thumb`,
  //           Body: fileBuffer,
  //           Bucket: record.s3.bucket.name,
  //           ContentType: 'image/jpeg',
  //         }, (err, res) => {
  //           if (err) {
  //             console.log({ err })
  //           }
  //           // // activate image
  //           // axios.put(`${process.env.HOST}/${name}/activate`)
  //           console.log({ res })
  //           console.log('done')
  //         })
  //         console.log('finished uploading')
  //       } catch (err) {
  //         console.log(`Unable to upload thumb ${name}`, err)
  //       }
  //       cb(null, 'success')
  //       return true
  //     })
  //   })
  // })
  //
  cb(null, 'success everything')
  return true
}
