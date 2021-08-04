import sql from '../../sql'

export const _updateCommentsCount = async( photoId: bigint) => {
  const photo = (await sql`UPDATE "Photos" SET "commentsCount" =
      (SELECT COUNT(*) from "Comments" where "Comments"."photoId" = ${photoId} and active = true)
      where id = ${photoId}
      returning *`)[0]
  return photo.commentsCount
}
