import sql from '../../sql'

import {_updateWatchers} from './_updateWatchers'

export default async function main(photoId: bigint, uuid: string) {

  await sql`
    DELETE FROM "Watchers"
    WHERE "photoId" = ${photoId}
      AND
    "uuid" = ${uuid}`

  const watchersCount = await _updateWatchers(photoId, uuid)
  return watchersCount
}
