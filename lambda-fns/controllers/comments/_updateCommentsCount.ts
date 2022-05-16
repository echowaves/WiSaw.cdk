import psql from '../../psql'

export const _updateCommentsCount = async( photoId: bigint) => {
  await psql.connect()
  const photo =
  (await psql.query(
    `UPDATE "Photos" SET "commentsCount" =
      (SELECT COUNT(*) from "Comments" where "Comments"."photoId" = ${photoId} and active = true)
      where id = ${photoId}
      returning *`)
  ).rows[0]
  await psql.clean()
  return photo.commentsCount
}
