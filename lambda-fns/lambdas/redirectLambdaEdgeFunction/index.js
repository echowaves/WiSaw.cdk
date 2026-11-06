const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

exports.handler = async (event) => {
  const request = event.Records[0].cf.request

  // CloudFront headers are in format: { "host": [{"key": "Host", "value": "www.wisaw.com"}] }
  const host = request.headers.host && request.headers.host[0].value

  // Function to convert integer ID to UUID format
  const convertIntegerIdToUuid = (integerId) => {
    const paddedId = integerId.toString().padStart(12, '0')
    return `00000000-0000-0000-0000-${paddedId}`
  }

  const buildRedirect = (path) => {
    let redirectUrl = `https://wisaw.com${path}`
    if (request.querystring) {
      redirectUrl += `?${request.querystring}`
    }
    return {
      status: '301',
      statusDescription: 'Moved Permanently',
      headers: {
        location: [{ key: 'Location', value: redirectUrl }]
      }
    }
  }

  // One photo, one URL. Ids are stored lower-cased and without a trailing slash, but
  // CloudFront happily serves /photos/35E9...DF35 and /photos/<id>/ as separate objects;
  // each of those used to canonicalise itself, so Google could index several originals per
  // photo. Redirecting the variants here consolidates signals instead of splitting them,
  // and keeps the injector free of redirect concerns.
  const mediaMatch = request.uri.match(/^(\/(?:photos|videos)\/)([^/]+)(\/?)$/)
  if (mediaMatch) {
    const [, prefix, idPart, trailingSlash] = mediaMatch
    const canonicalId = idPart.toLowerCase()
    if (UUID_RE.test(canonicalId) && (canonicalId !== idPart || trailingSlash)) {
      return buildRedirect(`/${prefix.split('/')[1]}/${canonicalId}`)
    }
  }

  // Check if URI requests an image or video with integer ID and redirect to UUID equivalent
  const uriMatch = request.uri.match(/^\/(photos|videos)\/(\d+)$/)
  if (uriMatch) {
    const [, type, integerId] = uriMatch
    // Convert integer ID to UUID format
    const uuid = convertIntegerIdToUuid(integerId)

    return buildRedirect(`/${type}/${uuid}`)
  }

  // Any other /photos|videos/<id> shape is served as-is. There used to be a normaliser here
  // that stripped every 0 and '-' from the id and re-padded what survived, which silently
  // rewrote valid legacy ids: /photos/…-000000029801 became /photos/…-000000002981, i.e. a
  // 301 to an unrelated photo or a 404. Legacy rows already store canonical UUIDs, so the
  // integer case above is the only rewrite that is actually needed.

  if (host === 'www.wisaw.com') {
    // Build the new URL, preserving query string if present
    return buildRedirect(request.uri)
  }

  // if (host === 'link.wisaw.com') {
  //   // Build the new URL, preserving query string if present
  //   let redirectUrl = `wisaw://link.wisaw.com${request.uri}`
  //   if (request.querystring) {
  //     redirectUrl += `?${request.querystring}`
  //   }
  //
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
