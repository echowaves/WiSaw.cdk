import moment from "moment"

import psql from "../../psql"
import { assertValidUuid } from '../../utilities/assertValidUuid'

import { _updateCommentsCount } from "./_updateCommentsCount"
import { _updateLastComment } from "./_updateLastComment"
import { _isPhotoInFrozenWave } from "../waves/_isPhotoInFrozenWave"

export default async function main(commentId: bigint, uuid: string) {
  assertValidUuid(uuid, 'uuid')

  const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  await psql.connect()

  // Look up the comment's photoId first to check frozen wave
  const commentLookup = await psql.query(`
    SELECT "photoId" FROM "Comments" WHERE "id" = $1
  `, [commentId])
  if (commentLookup.rows.length > 0) {
    const photoId = commentLookup.rows[0].photoId
    if (await _isPhotoInFrozenWave(photoId)) {
      await psql.clean()
      throw new Error('Cannot delete a comment on a photo that is in a frozen wave')
    }
  }

  const comment = (
    await psql.query(`
    UPDATE "Comments"
            SET
              "active" = false,
              "deactivatedBy" = $1,
              "updatedAt" = $2
        WHERE id = $3
        returning *`, [uuid, updatedAt, commentId])
  ).rows[0]
  await psql.clean()

  const { photoId } = comment

  const [commentsCount, lastComment] = await Promise.all([
    _updateCommentsCount(photoId),
    _updateLastComment(photoId),
  ])

  return lastComment
}
