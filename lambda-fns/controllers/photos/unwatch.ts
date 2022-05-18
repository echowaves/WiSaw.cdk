import psql from '../../psql'


import {_updateWatchers,} from './_updateWatchers'

export default async function main(photoId: bigint, uuid: string) {

  await psql.connect()

  await psql.query(`
    DELETE FROM "Watchers"
    WHERE "photoId" = ${photoId}
      AND
    "uuid" = '${uuid}'`)
  await psql.clean()

  const watchersCount = await _updateWatchers(photoId, uuid)
  return watchersCount
}
