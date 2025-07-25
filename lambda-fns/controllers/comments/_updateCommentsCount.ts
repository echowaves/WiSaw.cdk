import psql from '../../psql'

export const _updateCommentsCount = async( photoId: string) => {
  await psql.connect()
  const photo =
  (await psql.query(
    `UPDATE "Photos" SET "commentsCount" =
      (SELECT COUNT(*) from "Comments" where "Comments"."photoId" = $1 and active = true)
      where id = $2
      returning *`, [photoId, photoId])
  ).rows[0]
  await psql.clean()
  return photo.commentsCount
}
