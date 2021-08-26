import * as moment from 'moment'

const genThumbnail = require('simple-thumbnail')

import sql from '../../sql'

const AWS = require('aws-sdk')

const sharp = require('sharp')

import * as stream from "stream";

// const { pipeline } = require('stream');



// Write stream for uploading to S3
 function uploadReadableStream(Bucket: any, Key: any) {
  const pass = new stream.PassThrough();

  const S3 = new AWS.S3();

  return {
      writeStream: pass,
      upload: S3.upload({
         Bucket,
         Key,
         ContentType : 'image/jpeg',
         Body: pass,
       }).promise(),
    }
}

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
  const Bucket = record.s3.bucket.name
  // we only want to deal with originals
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!received image: ${name}`)
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  const s3 = new AWS.S3()

  let image =
    await s3.getObject({
      Bucket,
      Key: name,
    }).promise()

  // check if photo is video

  const sqlPhoto =  (await sql`
                    SELECT * FROM "Photos"
                    WHERE
                      "id" = ${photoId}
                    LIMIT 1
                    `
                  )[0]

  if(sqlPhoto.video === false) {
    console.log(1)
      await Promise.all([
         _genWebpThumb({image, Bucket, Key: `${photoId}-thumb`}),
         _genWebp({image, Bucket, Key: `${photoId}`}),
         _recognizeImage({Bucket, Key: `${name}`}),
      ])

      await Promise.all([
        _deleteUpload({ Bucket, Key: `${name}`}),
        _activatePhoto({ photoId }),
      ])

    cb(null, 'success everything')
    return true
  } else { // the received file is the video
    // next two operations are to move the .upload file to .video file in s3 bucket
    console.log(2)
    console.log({Bucket})
    console.log({name})
    console.log({photoId})

    await s3.copyObject({
                   Bucket,
                   CopySource: `/${Bucket}/${name}`,
                   Key: `${photoId}.video`
                 }).promise()

    console.log(3)


    const readStream = s3.getObject({ Bucket, Key: `${photoId}.video` }).createReadStream()

    // const readStream2 = readStream.pipe(genThumbnail(null, null, '100%'))

    // await uploadReadableStream(Bucket, photoId, readStream2 )
    const   {writeStream, upload} =  uploadReadableStream(Bucket, photoId)
    genThumbnail(readStream, writeStream, '100%', {
      path: './ffmpeg/ffmpeg-4.4-amd64-static/ffmpeg'
    })



    await upload

    //
    // var s3obj = new AWS.S3({params: {
    //   Bucket,
    //   Key: photoId,
    //   // ContentType : yourContentType,
    // }
    // });
    //
    // await s3obj.upload({Body: body}).promise()
      // .on('httpUploadProgress', function(evt: any) { console.log(evt); })
      // .send(function(err: any, data: any) { console.log(err, data) });



    // await upload

    console.log(4)

    image =
      await s3.getObject({
        Bucket,
        Key: photoId,
      }).promise()

    console.log(5)

    await Promise.all([
       _genWebpThumb({image, Bucket, Key: `${photoId}-thumb`}),
       _genWebp({image, Bucket, Key: `${photoId}`}),
       _recognizeImage({Bucket, Key: `${name}`}),
    ])
  console.log(6)

    await Promise.all([
      _deleteUpload({ Bucket, Key: `${name}`}),
      _activatePhoto({ photoId }),
    ])
  console.log(7)

  cb(null, 'success everything')
  return true
  }
}

const _genWebpThumb = async({image, Bucket, Key}: {image: any, Bucket: string, Key: string}) => {

  const buffer = await sharp(image.Body).rotate().webp({ lossless: false, quality: 80 }).resize({height: 300}).toBuffer()
  const s3 = new AWS.S3()
  await s3.putObject({
      Bucket,
      Key,
      Body: buffer,
      ContentType: 'image/webp',
      ACL: 'public-read',
      CacheControl: 'max-age=31536000',
    }).promise()
}

const _genWebp = async({image, Bucket, Key}: {image: any, Bucket: string, Key: string}) => {

  const buffer = await sharp(image.Body).rotate().webp({ lossless: false, quality: 90 }).toBuffer()
  const s3 = new AWS.S3()
  await s3.putObject({
      Bucket,
      Key,
      Body: buffer,
      ContentType: 'image/webp',
      ACL: 'public-read',
      CacheControl: 'max-age=31536000',
    }).promise()

}

const _deleteUpload = async({Bucket, Key}: {Bucket: string, Key: string}) => {
  const s3 = new AWS.S3()
  await s3.deleteObject({
    Bucket,
    Key,
  }).promise()
}

const _recognizeImage = async({Bucket, Key}: {Bucket: string, Key: string}) => {
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

    // console.log(JSON.stringify(metaData))
  } catch (err) {
    console.log('Error parsing image')
    console.log({err})
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
                      ${Key.replace('.upload', '')},
                      ${sql.json(metaData)},
                      ${createdAt},
                      ${createdAt}
                    )
                    returning *
                    `
                  )
    // console.log({result})
  } catch (err) {
    console.log('Error saving recognitions')
    console.log({err})
  }
}


const _activatePhoto = async({photoId}: {photoId: string}) => {
  try {
    const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

    const result = (await sql`
                    UPDATE "Photos"
                    set active = true, "updatedAt" = ${updatedAt}
                    WHERE
                    id = ${photoId}
                    `
                  )
    // console.log({result})
  } catch (err) {
    console.log('Error activating photo')
    console.log({err})
  }

}
