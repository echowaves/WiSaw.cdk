import moment from 'moment'

import AbuseReport from '../../models/abuseReport'

// eslint-disable-next-line import/prefer-default-export
export async function main(event, context, callback) {
  // Instruct the lambda to exit immediately
  // and not wait for node event loop to be empty.
  context.callbackWaitsForEmptyEventLoop = false // eslint-disable-line no-param-reassign
  const data = JSON.parse(event.body)

  // console.log({data})
  const uuid = data ? data.uuid : null

  let photoId = data ? data.photoId : null
  if (!photoId) {
    photoId = 0
  }

  if (!data || !uuid) {
    console.log('setting status to 400')
    const response = {
      statusCode: 400,
      body: JSON.stringify({ error: 'parameters missing' }),
    }
    callback(null, response)
    return
  }
  const createdAt = moment()
  const updatedAt = createdAt

  // create and safe record
  try {
    await AbuseReport.create({
      uuid, photoId, createdAt, updatedAt,
    })
  } catch (err) {
    console.log('unable to create AbuseReport', err)
    const response = {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unable to Report Abuse' }),
    }
    callback(null, response)
    return
  }

  // Resond to request indicating the aubse report was created
  const response = {
    statusCode: 201,
    body: JSON.stringify({ status: 'success' }),
  }
  callback(null, response)
}
