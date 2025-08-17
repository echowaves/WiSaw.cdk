import moment from "moment"
import { v4 as uuidv4 } from "uuid"

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
              WHERE "Photos"."uuid" = $1
  `, [uuid])
  ).rows[0].count

  // console.log({abuseCount})

  if (abuseCount > 3) {
    throw "You are banned"
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const updatedAt = createdAt
  const photoId = uuidv4()

  const photo = (
    await psql.query(`
                    INSERT INTO "Photos"
                    (
                        "id",
                        "uuid",
                        "location",
                        "video",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      $1,
                      $2,
                      ST_MakePoint($4, $3),
                      $5,
                      $6,
                      $7
                    )
                    returning *
                    `, [photoId, uuid, lat, lon, video ? true : false, createdAt, updatedAt])
  ).rows[0]
  await psql.clean()

  await watch(photo.id, uuid)

  // console.log({watcher})
  return plainToClass(Photo, photo)
}
