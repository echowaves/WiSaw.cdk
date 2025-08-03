import moment from "moment"
 
import psql from "../../psql"


import { DetectLabelsCommand, DetectModerationLabelsCommand, DetectTextCommand, RekognitionClient } from "@aws-sdk/client-rekognition"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"


const sharp = require("sharp")

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  // // define all the thumbnails that we want
  // const widths = {
  //   300: '-thumbnail x300', // converting to the height of 300
  // }
  //
  const record = event.Records[0]
  const name = record.s3.object.key
  const photoId = name.replace(".upload", "")
  const Bucket = record.s3.bucket.name
  // we only want to deal with originals
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!received image: ${name}`)
  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 1    photoId: ${photoId}`)

  const client = new S3Client({region: 'us-east-1' })

  const input = 
    {
      Bucket,
      Key: name,
    
  };

  const command = new GetObjectCommand(input);
  const { Body } = await client.send(command);

  const image = await Body.transformToByteArray();

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!'`, {image})

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 2    photoId: ${photoId}`)
  // const image = Buffer.from(await response.Body.transformToByteArray())

  await Promise.all([
    _genWebpThumb({ image, Bucket, Key: `${photoId}-thumb.webp` }),
    _genWebp({ image, Bucket, Key: `${photoId}.webp` }),
    _recognizeImage({ Bucket, Key: `${name}` }),
    _extractImageDimensions({ image, photoId }),
  ])

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 3    photoId: ${photoId}`)

  await Promise.all([
    _deleteUpload({ Bucket, Key: name }),
    _activatePhoto({ photoId }),
  ])

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 4   photoId: ${photoId}`)

  // cb(null, 'success everything')
  return true
}

const _genWebpThumb = async ({
  image,
  Bucket,
  Key,
}: {
  image: any
  Bucket: string
  Key: string
}) => {
  // console.log(`_genWebpThumb started  ${Key}`)
  const buffer = await sharp(image)
    .rotate()
    .webp({ lossless: false, quality: 90 })
    .resize({ height: 300 })
    .toBuffer()


  
    const putCommand = new PutObjectCommand({
      Bucket,
      Key,
      Body: buffer,
      ContentType: "image/webp",
      // ACL: "public-read",
      CacheControl: "max-age=31536000",
    })

    const client = new S3Client({region: 'us-east-1' })

    await client.send(putCommand)
  // console.log(`_genWebpThumb ended  ${Key}`)
}

const _genWebp = async ({
  image,
  Bucket,
  Key,
}: {
  image: any
  Bucket: string
  Key: string
}) => {
  // console.log(`_genWebp started  ${Key}`)

  const buffer = await sharp(image)
    .rotate()
    .webp({ lossless: false, quality: 90 })
    .toBuffer()
  
    

    const putCommand = new PutObjectCommand({
      Bucket,
      Key,
      Body: buffer,
      ContentType: "image/webp",
      // ACL: "public-read",
      CacheControl: "max-age=31536000",
    })

    const client = new S3Client({region: 'us-east-1' })

    await client.send(putCommand)

  // console.log(`_genWebp ended  ${Key}`)
}

const _deleteUpload = async ({
  Bucket,
  Key,
}: {
  Bucket: string
  Key: string
}) => {
  // console.log(`_deleteUpload started  ${Key}`)


    const deleteCommand = new DeleteObjectCommand({
      Bucket,
      Key,
    })

    const client = new S3Client({region: 'us-east-1' })

    await client.send(deleteCommand)

  // console.log(`_deleteUpload ended  ${Key}`)
}

const _recognizeImage = async ({
  Bucket,
  Key,
}: {
  Bucket: string
  Key: string
}) => {
  // console.log(`_recognizeImage started  ${Key}`)

  // console.log({Bucket, Key})
  
  const rekognitionClient = new RekognitionClient({
    region: "us-east-1",
    
  });

  // Download the image from S3 and convert to PNG in memory
  const s3Client = new S3Client({region: 'us-east-1' })
  const getObjectCommand = new GetObjectCommand({
    Bucket,
    Key,
  });
  const { Body } = await s3Client.send(getObjectCommand);
  
  if (!Body) {
    throw new Error(`Failed to download image from S3: ${Key}`)
  }
  
  const imageBuffer = await Body.transformToByteArray();
  
  // Convert to PNG format and resize to stay under 5MB limit
  let pngBuffer = await sharp(imageBuffer)
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()
  
  // If still too large, reduce size further
  if (pngBuffer.length > 5242880) { // 5MB in bytes
    console.log(`Image ${Key} is ${Math.round(pngBuffer.length / 1024 / 1024 * 100) / 100}MB, resizing further...`);
    pngBuffer = await sharp(imageBuffer)
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    
    // If STILL too large, try JPEG with lower quality
    if (pngBuffer.length > 5242880) {
      console.log(`Image ${Key} still too large, converting to JPEG...`);
      pngBuffer = await sharp(imageBuffer)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    }
  }
  
  const params = {
    Image: {
      Bytes: pngBuffer,
    },
  }
  // console.log(`_recognizeImage ended 1  ${Key}`)

  const metaData = {
    Labels: <any> [],
    TextDetections: <any> [],
    ModerationLabels: <any> [],
  }
  try {
    
    const [labelsData, moderationData, textData] = await Promise.all([
      rekognitionClient.send(new DetectLabelsCommand(params)),
      rekognitionClient.send(new DetectModerationLabelsCommand(params)),
      rekognitionClient.send(new DetectTextCommand(params)),
    ])

    
    // console.log(`_recognizeImage ended 2  ${Key}`)

    metaData.Labels = labelsData?.Labels || []
    // console.log(JSON.stringify(labelsData))

    metaData.ModerationLabels = moderationData?.ModerationLabels || []
    // console.log(JSON.stringify(moderationData))

    metaData.TextDetections = textData?.TextDetections || []
    // console.log(JSON.stringify(textData))

    // console.log(JSON.stringify(metaData))
  } catch (err) {
    console.error("Error parsing image")
    console.error({ err })
    // metaData.Labels = []
    // metaData.ModerationLabels = []
    // metaData.TextDetections = []
    
  }
  // console.log(`_recognizeImage ended 3  ${Key}`)

  try {
    const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

    // console.log({metaData: JSON.stringify(metaData),})
    await psql.connect()
    // const result =
    // (
    await psql.query(
      `    
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
      [Key.replace(".upload", ""), metaData, createdAt, createdAt],
    )
    // ).rows
    // console.log({result})
  } catch (err) {
    console.error("Error saving recognitions")
    console.error({ err })
  }
  await psql.clean()
  // console.log(`_recognizeImage ended 4  ${Key}`)
}

const _activatePhoto = async ({ photoId }: { photoId: string }) => {
  // console.log(`_activatePhoto started  ${photoId}`)

  try {
    const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

    await psql.connect()
    await psql.query(`    
                    UPDATE "Photos"
                    set active = true, "updatedAt" = $1
                    WHERE
                    id = $2
                    `, [updatedAt, photoId])
    // console.log({result})
  } catch (err) {
    console.error("Error activating photo")
    console.error({ err })
  }
  await psql.clean()
  // console.log(`_activatePhoto ended  ${photoId}`)
}

const _extractImageDimensions = async ({
  image,
  photoId,
}: {
  image: any
  photoId: string
}) => {
  // console.log(`_extractImageDimensions started  ${photoId}`)

  try {
    const metadata = await sharp(image).metadata()
    const width = metadata.width
    const height = metadata.height

    if (width && height) {
      const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

      await psql.connect()
      await psql.query(`    
                      UPDATE "Photos"
                      SET width = $1, height = $2, "updatedAt" = $3
                      WHERE id = $4
                      `, [width, height, updatedAt, photoId])
    }
  } catch (err) {
    console.error("Error extracting image dimensions")
    console.error({ err })
  }
  await psql.clean()
  // console.log(`_extractImageDimensions ended  ${photoId}`)
}
