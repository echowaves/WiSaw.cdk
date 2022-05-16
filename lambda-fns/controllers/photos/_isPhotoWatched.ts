import psql from '../../psql'

export const _isPhotoWatched = async( photoId: bigint, uuid: string) => {
  await psql.connect()
  const results =
  (await psql.query(`
  SELECT * FROM "Watchers"
              WHERE
                "photoId" = ${photoId}
                AND
                "uuid" = '${uuid}'
                `)
  ).rows
  await psql.clean()

  // console.log("_isPhotoWatched", {results,})
  return results.length > 0
}
