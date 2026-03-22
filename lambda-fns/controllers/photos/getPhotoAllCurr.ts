import { _getComments } from './_getComments'
import { _getPhoto } from './_getPhoto'
import { _getRecognitions } from './_getRecognitions'
import { isValidPhotoId } from '../../utilities/isValidPhotoId'

export default async function main(
  photoId: string,
) {
  if (!isValidPhotoId(photoId)) {
    throw new Error('Wrong UUID format for photoId')
  }

  const [
    photo,
    comments,
    recognitions,
  ] =
    await Promise.all([
      _getPhoto(photoId),
      _getComments(photoId),
      _getRecognitions(photoId),
    ])



  return {
    photo,
    comments,
    recognitions,
  }
}
