// import AWS from "aws-sdk"
var AWS = require("aws-sdk") //to use built-in modules

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

  const s3 = new AWS.S3()

  const data = await s3
    .getObject({
      Bucket: "wisaw-client",
      Key: "index.html",
    })
    .promise()

  const index = data.Body.toString("utf-8")

  const body = index.replace(
    "<head>",
    `<head>
      <meta name="image" property="og:image" content="https://img.wisaw.com/${imageId}">
      <meta name="description" property="og:description" content="Check out What I saw Today">
      <meta property="og:title" content="wisaw photo ${imageId}">
      <meta property="og:url" content="https://www.wisaw.com/photos/${imageId}">
      <meta property="og:site_name" content="wisaw.com">
      <link rel="canonical" href="https://www.wisaw.com/photos/${imageId}">
      <meta name="twitter:title" content="wisaw (What I Saw) photo ${imageId}">
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:image" content="https://img.wisaw.com/${imageId}">
  `,
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
