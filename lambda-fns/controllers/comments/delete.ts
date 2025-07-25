import moment from "moment"

import psql from "../../psql"

import { _updateCommentsCount } from "./_updateCommentsCount"
import { _updateLastComment } from "./_updateLastComment"

export default async function main(commentId: bigint, uuid: string) {
  const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  await psql.connect()
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
