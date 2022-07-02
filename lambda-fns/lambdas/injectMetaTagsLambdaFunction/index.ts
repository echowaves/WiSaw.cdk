export async function main(event: any = {}, context: any, callback: any) {
  // console.log({event: JSON.stringify(event)})
  const { request} = event.Records[0].cf
  const imageId = request.uri.replace('/photos/', '')

  console.log({imageId})

  const index = 
`
<\!DOCTYPE html>
<html lang="en" prefix="og: http://ogp.me/ns#" xmlns="http://www.w3.org/1999/xhtml" xmlns:fb="http://ogp.me/ns/fb#">
  <head>    
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="google-site-verification" content="RQGZzEN0xtT0w38pKeQ1L8u8P6dn7zxfu03jt0LGgF4" />
    <link rel="preconnect" href="https://www.wisaw.com" />
    <link rel="preconnect" href="https://s3.amazonaws.com" />
    <link rel="manifest" href="https://www.wisaw.com/manifest.json" />
    <link rel="apple-touch-icon" sizes="180x180" href="https://www.wisaw.com/apple-touch-icon.webp" />
    <link rel="icon" type="image/webp" href="https://www.wisaw.com/favicon-32x32.webp" sizes="32x32" />
    <link rel="icon" type="image/webp" href="https://www.wisaw.com/favicon-16x16.webp" sizes="16x16" />
    <link rel="mask-icon" href="https://www.wisaw.com/safari-pinned-tab.svg" color="#5bbad5" />
    <meta name="theme-color" content="#ffffff" />
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

  const body =  index.replace('<head>', 
  `<head>
    <meta name="image" property="og:image" content="https://wisaw-img-prod.s3.amazonaws.com/${imageId}" />
    <meta name="description" property="og:description" content="Check out What I saw Today" />
    <meta property="og:title" content="wisaw photo ${imageId}" />
    <meta property="og:url" content="https://www.wisaw.com/photos/${imageId}" />
    <meta property="og:site_name" content="wisaw.com" />
    <link rel="canonical" href="https://www.wisaw.com/photos/${imageId}" />
    <meta name="twitter:title" content="wisaw (What I Saw) photo ${imageId}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://wisaw-img-prod.s3.amazonaws.com/${imageId}" />
`
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
  }

  callback(null, response)
}
