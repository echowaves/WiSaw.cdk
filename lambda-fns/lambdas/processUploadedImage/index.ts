import psql from '../../psql'
import { traceLog } from '../../utilities/trace'
import dayjs from 'dayjs'

import autoGroupPhotosIntoWaves from '../../controllers/waves/autoGroupPhotosIntoWaves'
import { loadSeoPhotoRow } from '../../controllers/photos/_updateSeoSidecar'
import { learnDurationForId } from '../../controllers/photos/_learnVideoDurations'
import { putSeoSidecar, sidecarKey } from '../../utilities/seoSidecar'

import { DetectLabelsCommand, DetectModerationLabelsCommand, DetectTextCommand, RekognitionClient } from "@aws-sdk/client-rekognition"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import fetch from 'node-fetch'

const sharp = require("sharp")

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  const _traceStart = Date.now()
  traceLog('processUploadedImage:START')
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
  if (Body == null) throw new Error('S3 GetObject returned empty body for key: ' + String(name))

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

  // Delete upload file and activate photo
  await Promise.all([
    _deleteUpload({ Bucket, Key: name }),
    _activatePhoto({ photoId }),
  ])

  // Learn a new video's length now, so the sidecar written below already states it. Sequential
  // rather than part of the thumbnail Promise.all above: psql is one shared client and the
  // dimension step is already using it while the thumbs are made.
  await _learnVideoDuration({ Bucket, photoId })

  // Write the SEO sidecar so a brand-new page is enriched right away instead of waiting for the
  // 5-hour scheduled publisher. Awaited (the window is one minute), and it never throws — the
  // upload outcome must be identical to today when the write fails. Must run after _activatePhoto
  // or its active=true filter would skip the row.
  await _writeSeoSidecar({ Bucket, photoId })

  // Run auto-grouping using the existing controller
  // Get photo's uuid first
  await psql.connect()
  const photoResult = await psql.query(
    `SELECT "uuid" FROM "Photos" WHERE "id" = $1`,
    [photoId]
  )
  let photosGrouped = 0
  if (photoResult.rows.length > 0) {
    const uuid = photoResult.rows[0].uuid
    await psql.clean()
    
    // Loop until all photos are grouped (hasMore = false)
    // autoGroupPhotosIntoWaves processes up to 1000 photos per invocation
    let hasMore = true
    while (hasMore) {
      const result = await autoGroupPhotosIntoWaves(uuid, 'CITY')
      photosGrouped += result.photosGrouped
      hasMore = result.hasMore
    }
  } else {
    await psql.clean()
  }

  // Fire-and-forget notification with auto-grouping result
  // Call mutation via HTTP POST to AppSync GraphQL endpoint to trigger @aws_subscribe
  void _notifyViaAppSync(photoId, photosGrouped)

  // console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!   ended 4   photoId: ${photoId}`)

  // cb(null, 'success everything')
  traceLog('processUploadedImage:END', { duration: `${Date.now() - _traceStart}ms` })
  return true
}

// Fire-and-forget notification via AppSync GraphQL mutation
// Calling the mutation triggers the @aws_subscribe directive and notifies all clients
async function _notifyViaAppSync (photoId: string, photosGrouped: number): Promise<void> {
  try {
    const endpoint = process.env.APPSYNC_GRAPHQL_ENDPOINT
    const apiKey = process.env.APPSYNC_API_KEY
    if (!endpoint || !apiKey) return

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        mutation: 'mutation NotifyPhotoUploadComplete($photoId: String!, $photosGrouped: Int!) { _notifyPhotoUploadComplete(photoId: $photoId, photosGrouped: $photosGrouped) { photoId waveUuid photosGrouped } }',
        variables: { photoId, photosGrouped }
      })
    })
  } catch (err) {
    console.error('Subscription publish failed:', { err })
    // Don't throw - notification is best effort
  }
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
    .webp({ lossless: false, quality: 100 })
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
    .webp({ lossless: false, quality: 100 })
     .resize({ height: 3000 }) 
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
        .jpeg({ quality: 100 })
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
    const createdAt = dayjs().toISOString()

    const searchableText = [
      ...metaData.Labels.map((l: any) => l.Name).filter(Boolean),
      ...metaData.TextDetections.map((t: any) => t.DetectedText).filter(Boolean)
    ].join(' ')

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
                        "searchableText",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      $1,
                      $2,
                      $3,
                      $4,
                      $5
                    )
                    returning *
                    `,
      [Key.replace(".upload", ""), metaData, searchableText, createdAt, createdAt],
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
    const updatedAt = dayjs().toISOString()

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

// The stored container is the only place a video's length exists — the app never reports one and
// production objects carry no upload-time metadata — so reading it here, once per video, is what
// keeps a brand-new page from stating nothing until a comment, the bounded scheduled pass, or an
// operator run happens to touch it. learnDurationForId measures the stored video object for this id
// rather than the bytes that triggered processing (a video upload can trigger on its still poster),
// and returns without asking storage for anything when the row is an image or already measured.
// Same discipline as the sidecar step below: a failure here must not change the upload outcome.
export const _learnVideoDuration = async ({
  Bucket,
  photoId
}: {
  Bucket: string
  photoId: string
}): Promise<void> => {
  try {
    const client = new S3Client({ region: 'us-east-1' })
    await learnDurationForId(client, Bucket, photoId)
  } catch (err) {
    console.error('Error learning video duration at upload', { photoId, err })
  }
}

// Writes the photo's <id>.json sidecar at upload time so a brand-new page is enriched within
// seconds instead of waiting for the 5-hour scheduled publisher (which keeps running as the
// refresh path for later edits). The row is read fresh and in full through loadSeoPhotoRow —
// labels and dimensions were written by the first Promise.all, active=true by _activatePhoto —
// because a partial row would thin a richer sidecar. Every failure is logged and swallowed:
// this step must never change the upload outcome.
export const _writeSeoSidecar = async ({
  Bucket,
  photoId
}: {
  Bucket: string
  photoId: string
}): Promise<void> => {
  try {
    const photo = await loadSeoPhotoRow(photoId)
    if (photo == null) {
      // Deleted or never activated — no sidecar, and the publisher path stays responsible.
      console.log('Skipping SEO sidecar: no active photo row', { photoId })
      return
    }

    const client = new S3Client({ region: 'us-east-1' })
    await putSeoSidecar(client, Bucket, photo)

    // The read and the PUT are not atomic: a delete can commit in between, leaving <id>.json
    // behind for a photo that no longer exists. Re-check afterwards; cleanup-s3 stays the
    // backstop if this query itself fails.
    await psql.connect()
    let live
    try {
      live = await psql.query('SELECT "active" FROM "Photos" WHERE "id" = $1 AND "active" = true LIMIT 1', [photoId])
    } finally {
      await psql.clean()
    }
    if (live.rows.length === 0) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: sidecarKey(photoId) }))
      console.log('Removed SEO sidecar resurrected by a racing delete', { photoId })
    }
  } catch (err) {
    // A failed write only costs this photo its enrichment until the next publisher run.
    console.error('Error writing SEO sidecar at upload', { photoId, err })
  }
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
      const updatedAt = dayjs().toISOString()

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
