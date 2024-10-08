const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3"); // CommonJS import

exports.handler = async (event, context, callback) => {
  // console.log({ event })
  // console.log({ context })
  // console.log({event: JSON.stringify(event)})
  const { request } = event.Records[0].cf
  const imageId = request.uri
    .replace("/photos/", "")
    .replace("/videos/", "")
    .replace("/full", "")
    .replace("/thumb", "")
    .replace("/", "")

  // console.log("Received event:", JSON.stringify(event, null, 4))
  // console.log(
  //   ".......................................at the start..............................",
  // )

  // console.log({ imageId })

  // console.log({ event: event.Records[0].cf })
  // callback(null, request)

  const client = new S3Client({region: 'us-east-1' })

  const command = new GetObjectCommand({
    Bucket: "wisaw.com",
    Key: "index.html",
  });
  // console.log("-----------------------------------------------------1")
  const  { Body }  = await client.send(command);

  // console.log({ data })
  const index = await Body.transformToString();

  // const index = data.toString("utf-8")
  // const index = data.toString()

  // const command = new GetObjectCommand(input);
  // const { Body } = await client.send(command);

  // const image = await Body.transformToByteArray();

  // console.log({ data })
  // console.log({ index })

  const body = index
    .replace(
      /<\/title>/,
      `<\/title>
      <meta property="og:image" content="https://img.wisaw.com/${imageId}" data-rh="true">
      <meta property="og:description" content="Check out What I saw Today (photo)" data-rh="true">
      <meta property="og:title" content="wisaw photo ${imageId}" data-rh="true">
      <meta property="og:url" content="https://wisaw.com/photos/${imageId}" data-rh="true">
      <meta property="og:site_name" content="wisaw.com">
      <meta property='og:type' content='photo' data-rh="true"/>    
      <meta name="twitter:title" content="wisaw (What I Saw) photo ${imageId}" data-rh="true">
      <meta name="twitter:card" content="summary_large_image" data-rh="true">
      <meta name="twitter:image" content="https://img.wisaw.com/${imageId}" data-rh="true">
      `,
    )      
    .replace(
      `<link rel="canonical" href="https://wisaw.com" data-rh="true"/>`,
      `<link rel='canonical' href="https://wisaw.com/photos/${imageId}" data-rh="true">`
      ,
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
