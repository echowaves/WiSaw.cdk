import { _getComments } from './_getComments'
import { _getPhoto } from './_getPhoto'
import { _getRecognitions } from './_getRecognitions'

export default async function main(
  photoId: string,
) {

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
