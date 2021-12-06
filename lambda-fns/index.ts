// ******************************************************
//                       queries
// ******************************************************
import generateUploadUrl from './controllers/photos/generateUploadUrl'
import zeroMoment from './controllers/photos/zeroMoment'

import feedByDate from './controllers/photos/feedByDate'
import feedForWatcher from './controllers/photos/feedForWatcher'
import feedForTextSearch from './controllers/photos/feedForTextSearch'

import getPhotoDetails from './controllers/photos/getPhotoDetails'

import getPhotoAllCurr from './controllers/photos/getPhotoAllCurr'
import getPhotoAllNext from './controllers/photos/getPhotoAllNext'
import getPhotoAllPrev from './controllers/photos/getPhotoAllPrev'

import getFriendshipsList from './controllers/friendships/getFriendshipsList'

import getMessagesList from './controllers/messages/getMessagesList'

// ******************************************************
//                       mutations
// ******************************************************

import createContactForm from './controllers/contactForms/create'
import createAbuseReport from './controllers/abuseReports/create'

import createPhoto from './controllers/photos/create'
import watchPhoto from './controllers/photos/watch'
import unwatchPhoto from './controllers/photos/unwatch'
import deletePhoto from './controllers/photos/delete'
import createComment from './controllers/comments/create'
import deleteComment from './controllers/comments/delete'

import registerSecret from './controllers/secrets/register'

import createFriendship from './controllers/friendships/createFriendship'
import acceptFriendshipRequest from './controllers/friendships/acceptFriendshipRequest'
import deleteFriendship from './controllers/friendships/delete'

import updateSecret from './controllers/secrets/update'

import sendMessage from './controllers/messages/send'

import AbuseReport from './models/abuseReport'
import Photo from './models/photo'
import Message from './models/message'

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    // photo: Photo,
    // abuseReport: AbuseReport,
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
    video: boolean,
    assetKey: string,
    contentType: string,
    nickName: string,
    secret: string,
    newSecret: string,
    friendshipUuid: string,
    invitedByUuid: string,
    chatUuid: string,
    messageUuid: string,
    text: string,
    lastLoaded: string,
  }
}

exports.handler = async (event:AppSyncEvent) => {
  switch (event.info.fieldName) {
    // ******************************************************
    //                       queries
    // ******************************************************

    case 'generateUploadUrl':
      return await generateUploadUrl(
        event.arguments.assetKey,
        event. arguments.contentType,
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
    case 'getPhotoDetails':
      return await getPhotoDetails(
        event.arguments.photoId,
        event.arguments.uuid,
      )

    case 'getPhotoAllCurr':
      return await getPhotoAllCurr(
        event.arguments.photoId,
      )
    case 'getPhotoAllNext':
      return await getPhotoAllNext(
        event.arguments.photoId,
      )
    case 'getPhotoAllPrev':
      return await getPhotoAllPrev(
        event.arguments.photoId,
      )
    case 'getFriendshipsList':
      return await getFriendshipsList(
        event.arguments.uuid,
      )

    case 'getMessagesList':
      return await getMessagesList(
        event.arguments.chatUuid,
        event.arguments.lastRead,
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
        event.arguments.video,
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

    case 'registerSecret':
      return await registerSecret(
        event.arguments.uuid,
        event.arguments.nickName,
        event.arguments.secret,
      )
    case 'updateSecret':
      return await updateSecret(
        event.arguments.uuid,
        event.arguments.nickName,
        event.arguments.secret,
        event.arguments.newSecret,
      )

    case 'createFriendship':
      return await createFriendship(
        event.arguments.uuid,
      )
    case 'acceptFriendshipRequest':
      return await acceptFriendshipRequest(
        event.arguments.friendshipUuid,
        event.arguments.uuid,
      )
    case 'deleteFriendship':
      return await deleteFriendship(
        event.arguments.friendshipUuid,
      )

    case 'sendMessage':
      return await sendMessage(
        event.arguments.chatUuid,
        event.arguments.uuid,
        event.arguments.messageUuid,
        event.arguments.text,
      )

    default:
      return null
  }
}
