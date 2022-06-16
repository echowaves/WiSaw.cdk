const AWS = require('aws-sdk')

export async function main(event: any = {}, context: any, callback: any) {
  const {request} = event
  console.log({event})
  // var response = event.response

  var response = { 
    status: '200',
    statusDescription: 'OK',
    headers: {
        'cloudfront-functions': { value: 'generated-by-CloudFront-Functions' },
        'location': { value: 'https://aws.amazon.com/cloudfront/' }
    },
    body: 
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
  }

  // let originalUri = request.uri;
  // const parsedPath = path.parse(originalUri);
  
  // console.log({originalUri})
  // console.log({parsedPath})
  
  console.log({request})
  console.log({response})
  return callback(null, request)

}
