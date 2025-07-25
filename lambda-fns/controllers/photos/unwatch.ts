import psql from '../../psql'


import { _updateWatchers, } from './_updateWatchers'

export default async function main(photoId: string, uuid: string) {

  await psql.connect()

  await psql.query(`
    DELETE FROM "Watchers"
    WHERE "photoId" = $1
      AND
    "uuid" = $2`, [photoId, uuid])
  await psql.clean()

  const watchersCount = await _updateWatchers(photoId, uuid)
  return watchersCount
}
