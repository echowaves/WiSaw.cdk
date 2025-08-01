import moment from "moment"

import psql from "../../psql"

export const _updateLastComment = async (photoId: string) => {
  const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  await psql.connect()
  const photo = (
    await psql.query(`
    UPDATE "Photos"
      SET "lastComment" =
        (
          SELECT
            COALESCE(
              (
                SELECT "comment" from "Comments" where "Comments"."photoId" = "Photos"."id"
                AND "Comments"."active" = true
                ORDER BY "Comments"."createdAt" DESC
                LIMIT 1
              ),
              ''
            ) AS "comment"
        ),
        "updatedAt" = $1
      WHERE id = $2
      returning *`, [updatedAt, photoId])
  ).rows[0]
  await psql.clean()

  return photo.lastComment
}
