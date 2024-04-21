import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

exports.handler = async (event, context, callback) => {
  // console.log({ event })
  // console.log({ context })
  // console.log({event: JSON.stringify(event)})
  const { request } = event.Records[0].cf
  const imageId = request.uri
    .replace("/photos/", "")
    .replace("/full", "")
    .replace("/thumb", "")

  // console.log("Received event:", JSON.stringify(event, null, 4))
  // console.log(
  //   ".......................................at the start..............................",
  // )

  // console.log({ imageId })

  // console.log({ event: event.Records[0].cf })
  // callback(null, request)

  const client = new S3Client({region: 'us-east-1' })

  const command = new GetObjectCommand({
    Bucket: "wisaw-client",
    Key: "index.html",
  });
  // console.log("-----------------------------------------------------1")
  const data = await client.send(command);

  // console.log({ data })
  const index = data.Body.toString("utf-8")

  // const command = new GetObjectCommand(input);
  // const { Body } = await client.send(command);

  // const image = await Body.transformToByteArray();


  const body = index
    .replace(
      /<\/head>/,
      `<meta name="image" property="og:image" content="https://img.wisaw.com/${imageId}" data-rh="true"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta name="description" property="og:description" content="Check out What I saw Today" data-rh="true"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta property="og:title" content="wisaw photo ${imageId}"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta property="og:url" content="https://www.wisaw.com/photos/${imageId}"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta property="og:site_name" content="wisaw.com"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta property='og:type' content='article' /><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<link rel="canonical" href="https://www.wisaw.com/photos/${imageId}" data-rh="true"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta name="twitter:title" content="wisaw (What I Saw) photo ${imageId}"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta name="twitter:card" content="summary_large_image"><\/head>`,
    )
    .replace(
      /<\/head>/,
      `<meta name="twitter:image" content="https://img.wisaw.com/${imageId}"><\/head>`,
    )

  const response = {
    status: "200",
    statusDescription: "OK",
    headers: {
      "cache-control": [
        {
          key: "Cache-Control",
          value: "max-age=100",
        },
      ],
      "content-type": [
        {
          key: "Content-Type",
          value: "text/html",
        },
      ],
      "access-control-allow-origin": [
        { key: "Access-Control-Allow-Origin", value: "*" },
      ],
      "access-control-allow-methods": [
        { key: "Access-Control-Allow-Methods", value: "GET, HEAD" },
      ],
      "access-control-max-age": [
        { key: "Access-Control-Max-Age", value: "86400" },
      ],
    },
    body,
  }
  // console.log(
  //   ".......................................at the end..............................",
  // )
  // console.log({ response })
  callback(null, response)
}
