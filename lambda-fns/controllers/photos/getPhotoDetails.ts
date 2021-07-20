import {_getComments} from './_getComments'
import {_getRecognitions} from './_getRecognitions'
import {_isPhotoWatched} from './_isPhotoWatched'

export default async function main(
  photoId: bigint,
  uuid: string,
) {

  const [
    comments,
    recognitions,
    isPhotoWatched,
  ] =
    await Promise.all([
      _getComments(photoId),
      _getRecognitions(photoId),
      _isPhotoWatched(photoId, uuid),
    ])



  return {
    comments,
    recognitions,
    isPhotoWatched,
  }
}
