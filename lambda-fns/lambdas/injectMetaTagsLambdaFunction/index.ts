const AWS = require('aws-sdk')
const path = require('path')
const https = require('https')
const zlib = require('zlib')

const querystring = require('querystring')

export async function main(event: any = {}, context: any, callback: any) {
  console.log({event: JSON.stringify(event)})
  // var response = event.response

  const { request, config } = event.Records[0].cf

  const buffer = zlib.gzipSync(
    `
    <\!DOCTYPE html>
    <html lang="en" prefix="og: http://ogp.me/ns#" xmlns="http://www.w3.org/1999/xhtml" xmlns:fb="http://ogp.me/ns/fb#">
      <head>    
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="google-site-verification" content="RQGZzEN0xtT0w38pKeQ1L8u8P6dn7zxfu03jt0LGgF4" />
        <link rel="preconnect" href="https://www.wisaw.com" />
        <link rel="preconnect" href="https://s3.amazonaws.com" />
    
        <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="%PUBLIC_URL%/apple-touch-icon.webp" />
        <link rel="icon" type="image/webp" href="%PUBLIC_URL%/favicon-32x32.webp" sizes="32x32" />
        <link rel="icon" type="image/webp" href="%PUBLIC_URL%/favicon-16x16.webp" sizes="16x16" />
        <link rel="mask-icon" href="%PUBLIC_URL%/safari-pinned-tab.svg" color="#5bbad5" />
    
        <meta name="theme-color" content="#ffffff" />
        <meta name="hohoho" content="hohoho" />
        <link
        rel="preload"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta3/dist/css/bootstrap.min.css"
        as="style"
        integrity="sha384-eOJMYsd53ii+scO/bJGFsiCZc+5NDVN2yr8+0RDqr0Ql0h+rP48ckxlpbzKgwra6" crossorigin="anonymous"
        onload="this.onload=null;this.rel='stylesheet'" />
      </head>
      <body>
        <noscript>
          You need to enable JavaScript to run this app.
        </noscript>
        <div id="root"></div>        
      </body>
    </html>    
    `
  )
  
  const base64EncodedBody = buffer.toString('base64');



  var response = { 
    status: '200',
    statusDescription: 'OK',
    headers: {
      'content-type': [{key:'Content-Type', value: 'text/html'}],
      'content-encoding' : [{key:'Content-Encoding', value: 'gzip'}],
      'accept-ranges': [{key:'Accept-Ranges', value: 'bytes'}]
    },
    body: base64EncodedBody
  }

  // let originalUri = request.uri;
  // const parsedPath = path.parse(originalUri);
  
  // console.log({originalUri})
  // console.log({parsedPath})
  console.log({request: JSON.stringify(request)})

  // const body = Buffer.from(request.body.data, 'base64').toString();

  // console.log({body})

  callback(true, response)

  // console.log({response: JSON.stringify(response)})
  return callback(null, request)

}
