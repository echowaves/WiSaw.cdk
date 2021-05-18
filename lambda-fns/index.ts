import createAbuseReport from './controllers/abuseReports/create'
import listAbuseReports from './controllers/abuseReports/list'

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
  }
}

exports.handler = async (event:AppSyncEvent) => {
  switch (event.info.fieldName) {
    case 'listAbuseReports':
      return await listAbuseReports();
    case 'createAbuseReport':
      return await createAbuseReport(event.arguments.abuseReport)
    // case 'deletePost':
    //   return await deletePost(event.arguments.postId);
    // case 'getPostById':
    //   return await getPostById(event.arguments.postId);
    default:
      return null;
  }
}
