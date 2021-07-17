import sql from '../../sql'

export const _isPhotoWatched = async( photoId: bigint, uuid: string) => {
  const results = await sql`SELECT * FROM "Watchers"
              WHERE
                "photoId" = ${photoId}
                AND
                "uuid" = ${uuid}`

        return results.count > 0
}
