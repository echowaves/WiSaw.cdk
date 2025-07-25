import psql from '../../psql'

export const _isPhotoWatched = async( photoId: string, uuid: string) => {
  await psql.connect()
  const results =
  (await psql.query(`
  SELECT * FROM "Watchers"
              WHERE
                "photoId" = $1
                AND
                "uuid" = $2
                `, [photoId, uuid])
  ).rows
  await psql.clean()

  // console.log("_isPhotoWatched", {results,})
  return results.length > 0
}
