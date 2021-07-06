import createAbuseReport from './controllers/abuseReports/create'
import listAbuseReports from './controllers/abuseReports/list'

import createPhoto from './controllers/photos/create'
import generateUploadUrl from './controllers/photos/uploadUrl'

import AbuseReport from './models/abuseReport'
import Photo from './models/photo'

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    photo: Photo,
    abuseReport: AbuseReport,
    photoId: bigint,
    uuid: string,
    lat: string,
    lon: string,
  }
}

exports.handler = async (event:AppSyncEvent) => {
  switch (event.info.fieldName) {
    case 'listAbuseReports':
      return await listAbuseReports();
    case 'createAbuseReport':
      return await createAbuseReport(
        event.arguments.photoId,
        event.arguments.uuid
      )
    case 'createPhoto':
      return await createPhoto(
        event.arguments.uuid,
        event.arguments.lat,
        event.arguments.lon,
      )
    case 'generateUploadUrl':
      return await generateUploadUrl(
        event.arguments.photoId,
      )

    default:
      return null;
  }
}
