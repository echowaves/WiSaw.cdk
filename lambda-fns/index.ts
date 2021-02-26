import listPhotos from './listPhotos';
import Photo from './Photo';

type AppSyncEvent = {
  info: {
    fieldName: string
  },
  arguments: {
    photo: Photo,
    photoId: string
  }
}

exports.handler = async (event:AppSyncEvent) => {
  switch (event.info.fieldName) {
    case 'listPhotos':
      return await listPhotos();
    // case 'updatePost':
    //   return await updatePost(event.arguments.post);
    // case 'deletePost':
    //   return await deletePost(event.arguments.postId);
    // case 'getPostById':
    //   return await getPostById(event.arguments.postId);
    default:
      return null;
  }
}
