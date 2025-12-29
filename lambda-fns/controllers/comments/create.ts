import moment from "moment"

import psql from "../../psql"

import { _updateCommentsCount } from "./_updateCommentsCount"
import { _updateLastComment } from "./_updateLastComment"

import { _notifyAllWatchers } from "../photos/_notifyAllWatchers"
import watch from "../photos/watch"

export default async function main(
  photoId: string,
  uuid: string,
  description: string,
) {
  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  if (description.trim().length === 0) {
    throw "Unable to save empty comment."
  }
  await psql.connect()
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
  await _updateLastComment(photoId)
  
  await Promise.all([
    watch(photoId, uuid),
    _notifyAllWatchers(photoId),
  ])

  return comment
}
