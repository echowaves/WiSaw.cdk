// unused 
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  
  // CloudFront headers are in format: { "host": [{"key": "Host", "value": "www.wisaw.com"}] }
  const host = request.headers.host && request.headers.host[0].value;
  
  // Check if the URI ends with .webp
  if (request.uri.endsWith('.webp')) {
    // Remove the .webp extension from the URI
    request.uri = request.uri.slice(0, -5); // Remove last 5 characters (.webp)
  }

  return request;
};