import { _getComments } from './_getComments'
import { _getPhoto } from './_getPhoto'
import { _getRecognitions } from './_getRecognitions'
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main(
  photoId: string,
) {
  assertValidUuid(photoId, 'photoId')

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
