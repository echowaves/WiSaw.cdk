import abuseReportsCreate from './controllers/abuseReports/create'

// import listPhotos from './listPhotos'

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
    // case 'listPhotos':
    //   return await listPhotos();
    case 'abuseReportsCreate':
      return await abuseReportsCreate(event.arguments.abuseReport)
    // case 'deletePost':
    //   return await deletePost(event.arguments.postId);
    // case 'getPostById':
    //   return await getPostById(event.arguments.postId);
    default:
      return null;
  }
}
