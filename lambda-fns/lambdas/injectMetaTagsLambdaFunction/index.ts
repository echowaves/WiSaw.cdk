const AWS = require('aws-sdk')
const path = require('path')
const https = require('https')
const zlib = require('zlib')

const querystring = require('querystring')

export async function main(event: any = {}, context: any, callback: any) {
  console.log({event: JSON.stringify(event)})
  // var response = event.response
  // const { request, config } = event.Records[0].cf
// const body = `
// <\!DOCTYPE html>
// <html lang="en">
//   <head>
//     <meta charset="utf-8">
//     <title>Simple Lambda@Edge Static Content Response</title>
//   </head>
//   <body>
//     <p>Hello from Lambda@Edge!</p>
//   </body>
// </html>
// `;

  const { request} = event.Records[0].cf
  const imageId = request.uri.replace('/photos/', '')
  console.log({imageId})

  

  const index = 
`
<\!doctype html><html lang="en" prefix="og: http://ogp.me/ns#" xmlns="http://www.w3.org/1999/xhtml" xmlns:fb="http://ogp.me/ns/fb#"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="google-site-verification" content="RQGZzEN0xtT0w38pKeQ1L8u8P6dn7zxfu03jt0LGgF4"/><link rel="preconnect" href="https://www.wisaw.com"/><link rel="preconnect" href="https://s3.amazonaws.com"/><link rel="manifest" href="/manifest.json"/><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.webp"/><link rel="icon" type="image/webp" href="/favicon-32x32.webp" sizes="32x32"/><link rel="icon" type="image/webp" href="/favicon-16x16.webp" sizes="16x16"/><link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5"/><meta name="theme-color" content="#ffffff"/><link rel="preload" href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta3/dist/css/bootstrap.min.css" as="style" integrity="sha384-eOJMYsd53ii+scO/bJGFsiCZc+5NDVN2yr8+0RDqr0Ql0h+rP48ckxlpbzKgwra6" crossorigin="anonymous" onload='this.onload=null,this.rel="stylesheet"'/><script defer="defer" src="/static/js/main.8ee2345d.js"></script><link href="/static/css/main.e548762f.css" rel="stylesheet"></head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>
`

  const body =  index.replace('<head>', 
  `<head>
    <meta name="image" property="og:image" content="https://s3.amazonaws.com/wisaw-img-prod/${imageId}"} />`
  )

  const response = {
    status: '200',
    statusDescription: 'OK',
    headers: {
        'cache-control': [{
            key: 'Cache-Control',
            value: 'max-age=100'
        }],
        'content-type': [{
            key: 'Content-Type',
            value: 'text/html'
        }]
    },
    body,
};

  // let originalUri = request.uri;
  // const parsedPath = path.parse(originalUri);
  
  // console.log({originalUri})
  // console.log({parsedPath})
  // console.log({request: JSON.stringify(request)})

  // const body = Buffer.from(request.body.data, 'base64').toString();

  console.log({body})

  callback(null, response)

  // console.log({response: JSON.stringify(response)})
  // return callback(null, request)

}