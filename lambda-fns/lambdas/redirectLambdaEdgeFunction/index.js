exports.handler = async (event, context, callback) => {
  var request = event.request;
    var host = request.headers.host.value;

    if (host === 'www.wisaw.com') {    
        var response = {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 
                'location': { "value": `https://wisaw.com${request.uri}` } 
            }
        };

        return response;
    }

    return request;  
}
