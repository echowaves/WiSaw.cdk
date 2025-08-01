import moment from "moment"

import psql from "../../psql"

import { _updateWatchers } from "./_updateWatchers"

export default async function main(photoId: string, uuid: string) {
  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  await psql.connect()

  await psql.query(`
  DELETE FROM "Watchers"
      WHERE "photoId" = $1
        AND
      "uuid" = $2`, [photoId, uuid])

  await psql.query(`
      INSERT INTO "Watchers"
        (
            "uuid",
            "photoId",
            "createdAt",
            "updatedAt",
            "watchedAt"
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5
        )`, [uuid, photoId, createdAt, createdAt, createdAt])
  await psql.clean()

  const watchersCount = await _updateWatchers(photoId, uuid)
  return watchersCount
}
