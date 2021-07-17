// ******************************************************
//                       queries
// ******************************************************
import generateUploadUrl from './controllers/photos/generateUploadUrl'
import zeroMoment from './controllers/photos/zeroMoment'

import feedByDate from './controllers/photos/feedByDate'
import feedForWatcher from './controllers/photos/feedForWatcher'
import feedForTextSearch from './controllers/photos/feedForTextSearch'

// ******************************************************
//                       mutations
// ******************************************************

import createContactForm from './controllers/contactForms/create'
import createAbuseReport from './controllers/abuseReports/create'

import createPhoto from './controllers/photos/create'
import likePhoto from './controllers/photos/like'
import watchPhoto from './controllers/photos/watch'
import unwatchPhoto from './controllers/photos/unwatch'
import deletePhoto from './controllers/photos/delete'
import createComment from './controllers/comments/create'
import deleteComment from './controllers/comments/delete'


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
    description: string,
    commentId: bigint,
  }
}

exports.handler = async (event:AppSyncEvent) => {
  switch (event.info.fieldName) {
    // ******************************************************
    //                       queries
    // ******************************************************

    case 'generateUploadUrl':
      return await generateUploadUrl(
        event.arguments.photoId,
        )
    case 'zeroMoment':
      return await zeroMoment()


    case 'feedByDate':
      return await feedByDate(
        event.arguments.daysAgo,
        event.arguments.lat,
        event.arguments.lon,
        event.arguments.batch,
        event.arguments.whenToStop,
      )
    case 'feedForWatcher':
      return await feedForWatcher(
        event.arguments.uuid,
        event.arguments.pageNumber,
        event.arguments.batch,
      )
    case 'feedForTextSearch':
      return await feedForTextSearch(
        event.arguments.searchTerm,
        event.arguments.pageNumber,
        event.arguments.batch,
      )

    // ******************************************************
    //                       mutations
    // ******************************************************

    case 'createContactForm':
      return await createContactForm(
        event.arguments.uuid,
        event.arguments.description,
        )
    case 'createAbuseReport':
      return await createAbuseReport(
        event.arguments.photoId,
        event.arguments.uuid,
        )
    case 'createPhoto':
      return await createPhoto(
        event.arguments.uuid,
        event.arguments.lat,
        event.arguments.lon,
        )

    case 'likePhoto':
      return await likePhoto(
        event.arguments.photoId,
        event.arguments.uuid,
        )
    case 'watchPhoto':
      return await watchPhoto(
        event.arguments.photoId,
        event.arguments.uuid,
        )
    case 'unwatchPhoto':
      return await unwatchPhoto(
        event.arguments.photoId,
        event.arguments.uuid,
        )
    case 'deletePhoto':
      return await deletePhoto(
        event.arguments.photoId,
        event.arguments.uuid,
        )

    case 'createComment':
      return await createComment(
        event.arguments.photoId,
        event.arguments.uuid,
        event.arguments.description,
        )
    case 'deleteComment':
      return await deleteComment(
        event.arguments.commentId,
        event.arguments.uuid,
        )

    default:
      return null
  }
}
