import createAbuseReport from './controllers/abuseReports/create'
import listAbuseReports from './controllers/abuseReports/list'

import createPhoto from './controllers/photos/create'
import generateUploadUrl from './controllers/photos/generateUploadUrl'
import zeroMoment from './controllers/photos/zeroMoment'


import feedByDate from './controllers/photos/feedByDate'
import feedForWatcher from './controllers/photos/feedForWatcher'
import feedForTextSearch from './controllers/photos/feedForTextSearch'

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
    lat: number,
    lon: number,
    daysAgo: number,
    batch: number,
    whenToStop: string,
    pageNumber: number,
    searchTerm: string,
  }
}

exports.handler = async (event:AppSyncEvent) => {
  switch (event.info.fieldName) {
    case 'listAbuseReports':
      return await listAbuseReports()
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
    case 'zeroMoment':
      return await zeroMoment()
    case 'feedByDate':
      return await feedByDate(
        event.arguments.lat,
        event.arguments.lon,
        event.arguments.daysAgo,
        event.arguments.batch,
        event.arguments.whenToStop,
      )
    case 'feedForWatcher':
      return await feedForWatcher(
        event.arguments.uuid,
        event.arguments.pageNumber,
        event.arguments.batch,
        event.arguments.whenToStop,
      )
    case 'feedForTextSearch':
      return await feedForTextSearch(
        event.arguments.searchTerm,
        event.arguments.pageNumber,
        event.arguments.batch,
        event.arguments.whenToStop,
      )

    default:
      return null;
  }
}
