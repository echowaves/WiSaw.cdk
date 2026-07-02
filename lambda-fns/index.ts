// ******************************************************
//                       queries
// ******************************************************
import { traceWrap } from './utilities/trace'
import generateUploadUrl from './controllers/photos/generateUploadUrl'
import zeroMoment from './controllers/photos/zeroMoment'

import feedByDate from './controllers/photos/feedByDate'
import feedForTextSearch from './controllers/photos/feedForTextSearch'
import feedForWatcher from './controllers/photos/feedForWatcher'
import feedForUngrouped from './controllers/photos/feedForUngrouped'
import feedForWave from './controllers/photos/feedForWave'
import feedRecent from './controllers/photos/feedRecent'

import getPhotoDetails from './controllers/photos/getPhotoDetails'

import getPhotoAllCurr from './controllers/photos/getPhotoAllCurr'
import getPhotoAllNext from './controllers/photos/getPhotoAllNext'
import getPhotoAllPrev from './controllers/photos/getPhotoAllPrev'

import getFriendshipsList from './controllers/friendships/getFriendshipsList'
import feedForFriend from './controllers/friendships/feedForFriend'

import createWave from './controllers/waves/create'
import updateWave from './controllers/waves/update'
import deleteWave from './controllers/waves/delete'
import getWave from './controllers/waves/getWave'
import listWaves from './controllers/waves/listWaves'
import listPhotoLocations from './controllers/waves/listPhotoLocations'
import getUngroupedPhotosCount from './controllers/waves/getUngroupedPhotosCount'
import getWavesCount from './controllers/waves/getWavesCount'
import getWatchedCount from './controllers/photos/getWatchedCount'
import addPhotoToWave from './controllers/waves/addPhoto'
import removePhotoFromWave from './controllers/waves/removePhoto'
import autoGroupPhotosIntoWaves from './controllers/waves/autoGroupPhotosIntoWaves'
import mergeWaves from './controllers/waves/mergeWaves'
import createWaveInvite from './controllers/waves/createWaveInvite'
import revokeWaveInvite from './controllers/waves/revokeWaveInvite'
import joinWaveByInvite from './controllers/waves/joinWaveByInvite'
import joinOpenWave from './controllers/waves/joinOpenWave'
import assignFacilitator from './controllers/waves/assignFacilitator'
import removeFacilitator from './controllers/waves/removeFacilitator'
import removeUserFromWave from './controllers/waves/removeUserFromWave'
import reportWavePhoto from './controllers/waves/reportWavePhoto'
import dismissWaveReport from './controllers/waves/dismissWaveReport'
import banUserFromWave from './controllers/waves/banUserFromWave'
import listWaveMembers from './controllers/waves/listWaveMembers'
import listWaveInvites from './controllers/waves/listWaveInvites'
import listWaveAbuseReports from './controllers/waves/listWaveAbuseReports'
import listWaveBans from './controllers/waves/listWaveBans'
import isLocationInWave from './controllers/waves/isLocationInWave'

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
import notifyPhotoUploadComplete from './controllers/photos/_notifyPhotoUploadComplete'

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
    waveUuid: string
    name: string
    radius: number
    groupingLevel: string
    targetWaveUuid: string
    sourceWaveUuids: string[]
    sortBy: string
    sortDirection: string
    friendUuid: string
    inviteToken: string
    targetUuid: string
    reportId: string
    reason: string
    open: boolean
    splashDate: string
    freezeDate: string
    freezeMode: string
    expiresAt: string
    maxUses: number
    photosGrouped: number
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
  zeroMoment: {
    resolver: zeroMoment,
    getArgs: () => []
  },
  feedByDate: {
    resolver: feedByDate,
    getArgs: (args) => [args.daysAgo, args.lat, args.lon, args.batch, args.whenToStop, args.searchTerm]
  },
  feedForWatcher: {
    resolver: feedForWatcher,
    getArgs: (args) => [args.uuid, args.pageNumber, args.batch, args.searchTerm]
  },
  feedForUngrouped: {
    resolver: feedForUngrouped,
    getArgs: (args) => [args.uuid, args.pageNumber, args.batch, args.searchTerm]
  },
  feedForWave: {
    resolver: feedForWave,
    getArgs: (args) => [args.waveUuid, args.pageNumber, args.batch, args.searchTerm, args.sortBy, args.sortDirection]
  },
  feedRecent: {
    resolver: feedRecent,
    getArgs: (args) => [args.pageNumber, args.batch, args.searchTerm]
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
    getArgs: (args) => [args.uuid, args.sortBy, args.sortDirection]
  },
  getWave: {
    resolver: getWave,
    getArgs: (args) => [args.waveUuid, args.uuid]
  },
  listWaves: {
    resolver: listWaves,
    getArgs: (args) => [args.pageNumber, args.batch, args.uuid, args.sortBy, args.sortDirection, args.searchTerm]
  },
  listPhotoLocations: {
    resolver: listPhotoLocations,
    getArgs: (args) => [args.uuid, args.groupingLevel]
   },
  getUngroupedPhotosCount: {
    resolver: getUngroupedPhotosCount,
    getArgs: (args) => [args.uuid]
  },
  getWavesCount: {
    resolver: getWavesCount,
    getArgs: (args) => [args.uuid]
  },
  getWatchedCount: {
    resolver: getWatchedCount,
    getArgs: (args) => [args.uuid]
  },
  feedForFriend: {
    resolver: feedForFriend,
    getArgs: (args) => [args.uuid, args.friendUuid, args.pageNumber, args.batch, args.searchTerm, args.sortBy, args.sortDirection]
  },
  listWaveMembers: {
    resolver: listWaveMembers,
    getArgs: (args) => [args.waveUuid, args.uuid]
  },
  listWaveInvites: {
    resolver: listWaveInvites,
    getArgs: (args) => [args.waveUuid, args.uuid]
  },
  listWaveAbuseReports: {
    resolver: listWaveAbuseReports,
    getArgs: (args) => [args.waveUuid, args.uuid]
  },
  listWaveBans: {
    resolver: listWaveBans,
    getArgs: (args) => [args.waveUuid, args.uuid]
  },
  isLocationInWave: {
    resolver: isLocationInWave,
    getArgs: (args) => [args.lat, args.lon, args.waveUuid, args.uuid]
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
  createWave: {
    resolver: createWave,
    getArgs: (args) => [args.name, args.description, args.uuid, args.lat, args.lon, args.radius, args.groupingLevel, args.splashDate, args.freezeDate]
  },
  updateWave: {
    resolver: updateWave,
    getArgs: (args) => [args.waveUuid, args.uuid, args.name, args.description, args.lat, args.lon, args.radius, args.groupingLevel, args.open, args.splashDate, args.freezeDate, args.freezeMode]
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
    getArgs: (args) => [args.waveUuid, args.photoId, args.uuid]
  },
  autoGroupPhotosIntoWaves: {
    resolver: autoGroupPhotosIntoWaves,
    getArgs: (args) => [args.uuid, args.groupingLevel]
    },
  mergeWaves: {
    resolver: mergeWaves,
    getArgs: (args) => [args.targetWaveUuid, args.sourceWaveUuids, args.uuid, args.name, args.description]
  },
  createWaveInvite: {
    resolver: createWaveInvite,
    getArgs: (args) => [args.waveUuid, args.uuid, args.expiresAt, args.maxUses]
  },
  revokeWaveInvite: {
    resolver: revokeWaveInvite,
    getArgs: (args) => [args.inviteToken, args.uuid]
  },
  joinWaveByInvite: {
    resolver: joinWaveByInvite,
    getArgs: (args) => [args.inviteToken, args.uuid]
  },
  joinOpenWave: {
    resolver: joinOpenWave,
    getArgs: (args) => [args.waveUuid, args.uuid]
  },
  assignFacilitator: {
    resolver: assignFacilitator,
    getArgs: (args) => [args.waveUuid, args.targetUuid, args.uuid]
  },
  removeFacilitator: {
    resolver: removeFacilitator,
    getArgs: (args) => [args.waveUuid, args.targetUuid, args.uuid]
  },
  removeUserFromWave: {
    resolver: removeUserFromWave,
    getArgs: (args) => [args.waveUuid, args.targetUuid, args.uuid]
  },
  reportWavePhoto: {
    resolver: reportWavePhoto,
    getArgs: (args) => [args.waveUuid, args.photoId, args.uuid]
  },
  dismissWaveReport: {
    resolver: dismissWaveReport,
    getArgs: (args) => [args.reportId, args.uuid]
  },
  banUserFromWave: {
    resolver: banUserFromWave,
    getArgs: (args) => [args.waveUuid, args.targetUuid, args.uuid, args.reason]
  },
  _notifyPhotoUploadComplete: {
    resolver: notifyPhotoUploadComplete,
    getArgs: (args) => [args.photoId, args.photosGrouped]
  }
}

exports.main = async (event: AppSyncEvent) => {
  const handler =
    queryHandlers[event.info.fieldName] ?? mutationHandlers[event.info.fieldName]

  if (handler === undefined) return null

  return await traceWrap('handler', async () => {
    return await handler.resolver(...handler.getArgs(event.arguments))
  }, { fieldName: event.info.fieldName })
}
