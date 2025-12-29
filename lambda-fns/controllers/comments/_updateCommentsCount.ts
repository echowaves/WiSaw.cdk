import psql from '../../psql'
import moment from 'moment'

export const _updateCommentsCount = async( photoId: string) => {
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  await psql.connect()
  const photo =
  (await psql.query(
    `UPDATE "Photos" SET "commentsCount" =
      (SELECT COUNT(*) from "Comments" where "Comments"."photoId" = $1 and active = true),
      "updatedAt" = $3
      where id = $2
      returning *`, [photoId, photoId, updatedAt])
  ).rows[0]
  await psql.clean()
  return photo.commentsCount
}
