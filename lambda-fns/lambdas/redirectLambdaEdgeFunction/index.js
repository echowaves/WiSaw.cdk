exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  
  // CloudFront headers are in format: { "host": [{"key": "Host", "value": "www.wisaw.com"}] }
  const host = request.headers.host && request.headers.host[0].value;
  
  if (host === 'www.wisaw.com') {
    // Build the new URL, preserving query string if present
    let redirectUrl = `https://wisaw.com${request.uri}`;
    if (request.querystring) {
      redirectUrl += `?${request.querystring}`;
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
    };
  }

  // if (host === 'link.wisaw.com') {
  //   // Build the new URL, preserving query string if present
  //   let redirectUrl = `wisaw://link.wisaw.com${request.uri}`;
  //   if (request.querystring) {
  //     redirectUrl += `?${request.querystring}`;
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
  //   };
  // }
  
  return request;
};