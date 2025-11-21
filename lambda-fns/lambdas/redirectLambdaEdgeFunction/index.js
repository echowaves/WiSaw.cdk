exports.handler = async (event) => {
  const request = event.Records[0].cf.request

  // CloudFront headers are in format: { "host": [{"key": "Host", "value": "www.wisaw.com"}] }
  const host = request.headers.host && request.headers.host[0].value

  // Function to convert integer ID to UUID format
  const convertIntegerIdToUuid = (integerId) => {
    const paddedId = integerId.toString().padStart(12, '0')
    return `00000000-0000-0000-0000-${paddedId}`
  }

  // Check if URI requests an image or video with integer ID and redirect to UUID equivalent
  const uriMatch = request.uri.match(/^\/(photos|videos)\/(\d+)$/)
  if (uriMatch) {
    const [, type, integerId] = uriMatch
    // Convert integer ID to UUID format
    const uuid = convertIntegerIdToUuid(integerId)

    // Build the new URL with UUID
    let redirectUrl = `https://wisaw.com/${type}/${uuid}`
    if (request.querystring) {
      redirectUrl += `?${request.querystring}`
    }

    return {
      status: '301',
      statusDescription: 'Moved Permanently',
      headers: {
        location: [{
          key: 'Location',
          value: redirectUrl
        }]
      }
    }
  }

  if (host === 'www.wisaw.com') {
    // Build the new URL, preserving query string if present
    let redirectUrl = `https://wisaw.com${request.uri}`
    if (request.querystring) {
      redirectUrl += `?${request.querystring}`
    }

    return {
      status: '301',
      statusDescription: 'Moved Permanently',
      headers: {
        location: [{
          key: 'Location',
          value: redirectUrl
        }]
      }
    }
  }

  // if (host === 'link.wisaw.com') {
  //   // Build the new URL, preserving query string if present
  //   let redirectUrl = `wisaw://link.wisaw.com${request.uri}`
  //   if (request.querystring) {
  //     redirectUrl += `?${request.querystring}`
  //   }

  //   return {
  //     status: '301',
  //     statusDescription: 'Moved Permanently',
  //     headers: {
  //       location: [{
  //         key: 'Location',
  //         value: redirectUrl
  //       }]
  //     }
  //   }
  // }
  return request
}
