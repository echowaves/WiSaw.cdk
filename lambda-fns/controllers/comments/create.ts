import moment from "moment"

import psql from "../../psql"
import { assertValidUuid } from '../../utilities/assertValidUuid'

import { _updateCommentsCount } from "./_updateCommentsCount"
import { _updateLastComment } from "./_updateLastComment"

import { _notifyAllWatchers } from "../photos/_notifyAllWatchers"
import watch from "../photos/watch"
import { _isPhotoInFrozenWaveForUser } from "../waves/_isPhotoInFrozenWaveForUser"

export default async function main(
  photoId: string,
  uuid: string,
  description: string,
) {
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  if (description.trim().length === 0) {
    throw "Unable to save empty comment."
  }
  await psql.connect()

  if (await _isPhotoInFrozenWaveForUser(photoId, uuid)) {
    await psql.clean()
    throw new Error('Cannot comment on a photo that is in a frozen wave')
  }

  const comment = (
    await psql.query(`
    INSERT INTO "Comments"
      (
          "photoId",
          "uuid",
          "comment",
          "createdAt",
          "updatedAt"
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      returning *
      `, [
      photoId,
      uuid,
      description,
      createdAt,
      createdAt
    ])
  ).rows[0]
  await psql.clean()

  // console.log({comment})
  // Run photo update operations sequentially to avoid race conditions
  // with the shared database connection and ensure updatedAt is properly set
  await _updateCommentsCount(photoId)

  await Promise.all([
    _updateLastComment(photoId),
    watch(photoId, uuid),
    _notifyAllWatchers(photoId)
  ])

  return comment
}
