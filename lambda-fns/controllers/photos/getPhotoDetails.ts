import {_getComments} from './getComments'
import {_getRecognitions} from './getRecognitions'
import {_isPhotoWatched} from './isPhotoWatched'

export default async function main(
  photoId: bigint,
  uuid: string,
) {

  const [
    comments,
    regognitions,
    isPhotoWatched,
  ] =
    await Promise.all([
      _getComments(photoId),
      _getRecognitions(photoId),
      _isPhotoWatched(photoId, uuid),
    ])



  return {
    comments,
    regognitions,
    isPhotoWatched,
  }
}
