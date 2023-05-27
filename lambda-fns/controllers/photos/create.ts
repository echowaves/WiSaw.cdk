import moment from "moment"

import { plainToClass } from "class-transformer"

import psql from "../../psql"

import Photo from "../../models/photo"
import watch from "./watch"

export default async function main(
  uuid: string,
  lat: number,
  lon: number,
  video: boolean,
) {
  await psql.connect()
  // first count how many times photos from this device were reported
  const abuseCount = (
    await psql.query(`
      SELECT COUNT(*)
              FROM "AbuseReports"
              INNER JOIN "Photos" on "AbuseReports"."photoId" = "Photos"."id"
              WHERE "Photos"."uuid" = '${uuid}'
  `)
  ).rows[0].count

  // console.log({abuseCount})

  if (abuseCount > 3) {
    throw "You are banned"
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const updatedAt = createdAt

  const photo = (
    await psql.query(`
                    INSERT INTO "Photos"
                    (
                        "uuid",
                        "location",
                        "video",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      '${uuid}',
                      ST_MakePoint(${lat}, ${lon}),
                      ${video ? true : false}, 
                      '${createdAt}',
                      '${updatedAt}'
                    )
                    returning *
                    `)
  ).rows[0]
  await psql.clean()

  await watch(photo.id, uuid)

  // console.log({watcher})
  return plainToClass(Photo, photo)
}
