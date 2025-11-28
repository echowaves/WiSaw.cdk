/* eslint-env node */
/* global require, exports, console */
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3') // CommonJS import
const { sanitizeImageId, injectMetaTags } = require('./utils')

exports.handler = async (event, context, callback) => {
  // console.log({ event })
  // console.log({ context })
  // console.log({event: JSON.stringify(event)})
  const { request } = event.Records[0].cf
  const { text: imageIdText, url: imageIdUrl, raw: imageIdRaw } = sanitizeImageId(request.uri)

  // console.log("Received event:", JSON.stringify(event, null, 4))
  // console.log(
  //   ".......................................at the start..............................",
  // )

  // console.log({ imageId })

  // console.log({ event: event.Records[0].cf })
  // callback(null, request)

  const client = new S3Client({ region: 'us-east-1' })

  let created = new Date().toISOString()
  let duration
  try {
    const headCommand = new HeadObjectCommand({
      Bucket: 'wisaw-img-prod',
      Key: `${imageIdRaw}.mov`
    })
    const headData = await client.send(headCommand)
    if (headData.LastModified) {
      created = headData.LastModified.toISOString()
    }
    if (headData.Metadata && headData.Metadata.duration) {
      duration = headData.Metadata.duration
    }
  } catch (e) {
    // eslint-disable-next-line no-console, no-undef
    console.error('Error fetching video metadata:', e)
  }

  const command = new GetObjectCommand({
    Bucket: 'wisaw.com',
    Key: 'index.html'
  })
  // console.log("-----------------------------------------------------1")
  const { Body } = await client.send(command)

  // console.log({ data })
  const index = await Body.transformToString()

  // const index = data.toString("utf-8")
  // const index = data.toString()

  // const command = new GetObjectCommand(input)
  // const { Body } = await client.send(command)

  // const image = await Body.transformToByteArray()

  // console.log({ data })
  // console.log({ index })

  const body = injectMetaTags(index, {
    description: 'Check out What I saw Today (video)',
    entityLabel: 'video',
    ogType: 'video',
    pathSegment: 'videos',
    imageIdText,
    imageIdUrl,
    created,
    duration,
    videoUrl: `https://img.wisaw.com/${imageIdRaw}.mov`
  })

  const response = {
    status: '200',
    statusDescription: 'OK',
    headers: {
      'cache-control': [
        {
          key: 'Cache-Control',
          value: 'max-age=100'
        }
      ],
      'content-type': [
        {
          key: 'Content-Type',
          value: 'text/html'
        }
      ],
      'access-control-allow-origin': [
        { key: 'Access-Control-Allow-Origin', value: '*' }
      ],
      'access-control-allow-methods': [
        { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD' }
      ],
      'access-control-max-age': [
        { key: 'Access-Control-Max-Age', value: '86400' }
      ]
    },
    body
  }
  // console.log(
  //   ".......................................at the end..............................",
  // )
  // console.log({ response })
  callback(null, response)
}
