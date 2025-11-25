// ******************************************************
//                       queries
// ******************************************************
import generateUploadUrlForMessage from './controllers/messages/generateUploadUrlForMessage'
import generateUploadUrl from './controllers/photos/generateUploadUrl'
import zeroMoment from './controllers/photos/zeroMoment'

import feedByDate from './controllers/photos/feedByDate'
import feedForTextSearch from './controllers/photos/feedForTextSearch'
import feedForWatcher from './controllers/photos/feedForWatcher'
import feedRecent from './controllers/photos/feedRecent'

import getPhotoDetails from './controllers/photos/getPhotoDetails'

import getPhotoAllCurr from './controllers/photos/getPhotoAllCurr'
import getPhotoAllNext from './controllers/photos/getPhotoAllNext'
import getPhotoAllPrev from './controllers/photos/getPhotoAllPrev'

import getFriendshipsList from './controllers/friendships/getFriendshipsList'
import getUnreadCountsList from './controllers/friendships/getUnreadCountsList'

import getMessagesList from './controllers/messages/getMessagesList'

import createWave from './controllers/waves/create'
import deleteWave from './controllers/waves/delete'
import listWaves from './controllers/waves/listWaves'
import addPhotoToWave from './controllers/waves/addPhoto'
import removePhotoFromWave from './controllers/waves/removePhoto'
import listWavePhotos from './controllers/waves/listWavePhotos'

// ******************************************************
//                       mutations
// ******************************************************

import createAbuseReport from './controllers/abuseReports/create'
import createContactForm from './controllers/contactForms/create'

import createComment from './controllers/comments/create'
import deleteComment from './controllers/comments/delete'
import createPhoto from './controllers/photos/create'
import deletePhoto from './controllers/photos/delete'
import unwatchPhoto from './controllers/photos/unwatch'
import watchPhoto from './controllers/photos/watch'

import registerSecret from './controllers/secrets/register'

import acceptFriendshipRequest from './controllers/friendships/acceptFriendshipRequest'
import createFriendship from './controllers/friendships/createFriendship'
import deleteFriendship from './controllers/friendships/delete'

import updateSecret from './controllers/secrets/update'

import sendMessage from './controllers/messages/send'

import resetUnreadCount from './controllers/messages/resetUnreadCount'

// import AbuseReport from './models/abuseReport'
// import Photo from './models/photo'
// import Message from './models/message'

interface AppSyncEvent {
  info: {
    fieldName: string
  }
  arguments: {
    // photo: Photo,
    // abuseReport: AbuseReport,
    photoId: string
    uuid: string
    lat: number
    lon: number
    daysAgo: number
    batch: string
    whenToStop: string
    pageNumber: number
    searchTerm: string
    description: string
    commentId: bigint
    video: boolean
    width: number
    height: number
    assetKey: string
    contentType: string
    nickName: string
    secret: string
    newSecret: string
    friendshipUuid: string
    invitedByUuid: string
    chatUuid: string
    messageUuid: string
    text: string
    lastLoaded: string

    chatUuidArg: string
    uuidArg: string
    messageUuidArg: string
    textArg: string
    photoHash: string
    pendingArg: boolean
    chatPhotoHashArg: string
    waveUuid: string
    name: string
  }
}

interface HandlerDefinition {
  resolver: (...params: any[]) => Promise<any>
  getArgs: (args: AppSyncEvent['arguments']) => any[]
}

const queryHandlers: Record<string, HandlerDefinition> = {
  generateUploadUrl: {
    resolver: generateUploadUrl,
    getArgs: (args) => [args.assetKey, args.contentType]
  },
  generateUploadUrlForMessage: {
    resolver: generateUploadUrlForMessage,
    getArgs: (args) => [args.uuid, args.photoHash, args.contentType]
  },
  zeroMoment: {
    resolver: zeroMoment,
    getArgs: () => []
  },
  feedByDate: {
    resolver: feedByDate,
    getArgs: (args) => [args.daysAgo, args.lat, args.lon, args.batch, args.whenToStop]
  },
  feedForWatcher: {
    resolver: feedForWatcher,
    getArgs: (args) => [args.uuid, args.pageNumber, args.batch]
  },
  feedRecent: {
    resolver: feedRecent,
    getArgs: (args) => [args.pageNumber, args.batch]
  },
  feedForTextSearch: {
    resolver: feedForTextSearch,
    getArgs: (args) => [args.searchTerm, args.pageNumber, args.batch]
  },
  getPhotoDetails: {
    resolver: getPhotoDetails,
    getArgs: (args) => [args.photoId, args.uuid]
  },
  getPhotoAllCurr: {
    resolver: getPhotoAllCurr,
    getArgs: (args) => [args.photoId]
  },
  getPhotoAllNext: {
    resolver: getPhotoAllNext,
    getArgs: (args) => [args.photoId]
  },
  getPhotoAllPrev: {
    resolver: getPhotoAllPrev,
    getArgs: (args) => [args.photoId]
  },
  getFriendshipsList: {
    resolver: getFriendshipsList,
    getArgs: (args) => [args.uuid]
  },
  getUnreadCountsList: {
    resolver: getUnreadCountsList,
    getArgs: (args) => [args.uuid]
  },
  getMessagesList: {
    resolver: getMessagesList,
    getArgs: (args) => [args.chatUuid, args.lastLoaded]
  },
  listWaves: {
    resolver: listWaves,
    getArgs: (args) => [args.pageNumber, args.batch]
  },
  listWavePhotos: {
    resolver: listWavePhotos,
    getArgs: (args) => [args.waveUuid, args.pageNumber, args.batch]
  }
}

const mutationHandlers: Record<string, HandlerDefinition> = {
  createContactForm: {
    resolver: createContactForm,
    getArgs: (args) => [args.uuid, args.description]
  },
  createAbuseReport: {
    resolver: createAbuseReport,
    getArgs: (args) => [args.photoId, args.uuid]
  },
  createPhoto: {
    resolver: createPhoto,
    getArgs: (args) => [args.uuid, args.lat, args.lon, args.video, args.width, args.height]
  },
  watchPhoto: {
    resolver: watchPhoto,
    getArgs: (args) => [args.photoId, args.uuid]
  },
  unwatchPhoto: {
    resolver: unwatchPhoto,
    getArgs: (args) => [args.photoId, args.uuid]
  },
  deletePhoto: {
    resolver: deletePhoto,
    getArgs: (args) => [args.photoId, args.uuid]
  },
  createComment: {
    resolver: createComment,
    getArgs: (args) => [args.photoId, args.uuid, args.description]
  },
  deleteComment: {
    resolver: deleteComment,
    getArgs: (args) => [args.commentId, args.uuid]
  },
  registerSecret: {
    resolver: registerSecret,
    getArgs: (args) => [args.uuid, args.nickName, args.secret]
  },
  updateSecret: {
    resolver: updateSecret,
    getArgs: (args) => [args.uuid, args.nickName, args.secret, args.newSecret]
  },
  createFriendship: {
    resolver: createFriendship,
    getArgs: (args) => [args.uuid]
  },
  acceptFriendshipRequest: {
    resolver: acceptFriendshipRequest,
    getArgs: (args) => [args.friendshipUuid, args.uuid]
  },
  deleteFriendship: {
    resolver: deleteFriendship,
    getArgs: (args) => [args.friendshipUuid]
  },
  sendMessage: {
    resolver: sendMessage,
    getArgs: (args) => [
      args.chatUuidArg,
      args.uuidArg,
      args.messageUuidArg,
      args.textArg,
      args.pendingArg,
      args.chatPhotoHashArg
    ]
  },
  resetUnreadCount: {
    resolver: resetUnreadCount,
    getArgs: (args) => [args.chatUuid, args.uuid]
  },
  createWave: {
    resolver: createWave,
    getArgs: (args) => [args.name, args.description, args.uuid]
  },
  deleteWave: {
    resolver: deleteWave,
    getArgs: (args) => [args.waveUuid, args.uuid]
  },
  addPhotoToWave: {
    resolver: addPhotoToWave,
    getArgs: (args) => [args.waveUuid, args.photoId, args.uuid]
  },
  removePhotoFromWave: {
    resolver: removePhotoFromWave,
    getArgs: (args) => [args.waveUuid, args.photoId]
  }
}

exports.main = async (event: AppSyncEvent) => {
  const handler =
    queryHandlers[event.info.fieldName] ?? mutationHandlers[event.info.fieldName]

  if (handler === undefined) return null

  return await handler.resolver(...handler.getArgs(event.arguments))
}

