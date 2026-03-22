import { _getComments } from './_getComments'
import { _getRecognitions } from './_getRecognitions'
import { _isPhotoWatched } from './_isPhotoWatched'
import { _getWaveInfo } from './_getWaveInfo'
import { isValidPhotoId } from '../../utilities/isValidPhotoId'

export default async function main(
  photoId: string,
  uuid: string,
) {
  if (!isValidPhotoId(photoId)) {
    throw new Error('Wrong UUID format for photoId')
  }

  const [
    comments,
    recognitions,
    isPhotoWatched,
    waveInfo,
  ] =
    await Promise.all([
      _getComments(photoId),
      _getRecognitions(photoId),
      _isPhotoWatched(photoId, uuid),
      _getWaveInfo(photoId),
    ])

  return {
    comments,
    recognitions,
    isPhotoWatched,
    waveName: waveInfo.waveName,
    waveUuid: waveInfo.waveUuid,
  }
}
