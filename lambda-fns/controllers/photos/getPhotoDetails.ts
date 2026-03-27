import { _getComments } from './_getComments'
import { _getRecognitions } from './_getRecognitions'
import { _isPhotoWatched } from './_isPhotoWatched'
import { _getWaveInfo } from './_getWaveInfo'
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main(
  photoId: string,
  uuid: string,
) {
  assertValidUuid(photoId, 'photoId')

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
