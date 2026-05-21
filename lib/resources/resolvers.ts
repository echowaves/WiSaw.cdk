import * as appsync from 'aws-cdk-lib/aws-appsync'
import { Construct } from 'constructs'

export function createResolvers (scope: Construct, api: appsync.GraphqlApi, lambdaDs: appsync.BaseDataSource): void {
  const fields = [
    { typeName: 'Query', fieldName: 'generateUploadUrl' },
    { typeName: 'Query', fieldName: 'zeroMoment' },
    { typeName: 'Query', fieldName: 'feedByDate' },
    { typeName: 'Query', fieldName: 'feedForWatcher' },
    { typeName: 'Query', fieldName: 'feedForWave' },
    { typeName: 'Query', fieldName: 'feedRecent' },
    { typeName: 'Query', fieldName: 'feedForTextSearch' },
    { typeName: 'Query', fieldName: 'getPhotoDetails' },
    { typeName: 'Query', fieldName: 'getPhotoAllCurr' },
    { typeName: 'Query', fieldName: 'getPhotoAllNext' },
    { typeName: 'Query', fieldName: 'getPhotoAllPrev' },
    { typeName: 'Query', fieldName: 'getFriendshipsList' },
    { typeName: 'Query', fieldName: 'listWaves' },
    { typeName: 'Query', fieldName: 'getWave' },
    { typeName: 'Query', fieldName: 'listWavePhotos' },
    { typeName: 'Query', fieldName: 'listPhotoLocations' },
    { typeName: 'Query', fieldName: 'feedForUngrouped' },
    { typeName: 'Query', fieldName: 'getUngroupedPhotosCount' },
    { typeName: 'Query', fieldName: 'getWavesCount' },
    { typeName: 'Query', fieldName: 'getWatchedCount' },
    { typeName: 'Query', fieldName: 'feedForFriend' },
    { typeName: 'Query', fieldName: 'listWaveMembers' },
    { typeName: 'Query', fieldName: 'listWaveInvites' },
    { typeName: 'Query', fieldName: 'listWaveAbuseReports' },
    { typeName: 'Query', fieldName: 'listWaveBans' },
    { typeName: 'Query', fieldName: 'isLocationInWave' },

    { typeName: 'Mutation', fieldName: 'createContactForm' },
    { typeName: 'Mutation', fieldName: 'createAbuseReport' },
    { typeName: 'Mutation', fieldName: 'createPhoto' },
    { typeName: 'Mutation', fieldName: 'watchPhoto' },
    { typeName: 'Mutation', fieldName: 'unwatchPhoto' },
    { typeName: 'Mutation', fieldName: 'deletePhoto' },
    { typeName: 'Mutation', fieldName: 'createComment' },
    { typeName: 'Mutation', fieldName: 'deleteComment' },
    { typeName: 'Mutation', fieldName: 'registerSecret' },
    { typeName: 'Mutation', fieldName: 'updateSecret' },
    { typeName: 'Mutation', fieldName: 'createFriendship' },
    { typeName: 'Mutation', fieldName: 'acceptFriendshipRequest' },
    { typeName: 'Mutation', fieldName: 'deleteFriendship' },
    { typeName: 'Mutation', fieldName: 'createWave' },
    { typeName: 'Mutation', fieldName: 'updateWave' },
    { typeName: 'Mutation', fieldName: 'deleteWave' },
    { typeName: 'Mutation', fieldName: 'addPhotoToWave' },
    { typeName: 'Mutation', fieldName: 'removePhotoFromWave' },
    { typeName: 'Mutation', fieldName: 'autoGroupPhotosIntoWaves' },
    { typeName: 'Mutation', fieldName: 'mergeWaves' },
    { typeName: 'Mutation', fieldName: 'createWaveInvite' },
    { typeName: 'Mutation', fieldName: 'revokeWaveInvite' },
    { typeName: 'Mutation', fieldName: 'joinWaveByInvite' },
    { typeName: 'Mutation', fieldName: 'joinOpenWave' },
    { typeName: 'Mutation', fieldName: 'assignFacilitator' },
    { typeName: 'Mutation', fieldName: 'removeFacilitator' },
    { typeName: 'Mutation', fieldName: 'removeUserFromWave' },
    { typeName: 'Mutation', fieldName: 'reportWavePhoto' },
    { typeName: 'Mutation', fieldName: 'dismissWaveReport' },
    { typeName: 'Mutation', fieldName: 'banUserFromWave' }
  ]
  fields.forEach(({ typeName, fieldName }) =>
    lambdaDs.createResolver(`${typeName}-${fieldName}-Resolver`, {
      typeName,
      fieldName
    })
  )
}
