import * as moment from 'moment'

import { plainToClass } from 'class-transformer';

import sql from '../../sql'

import Photo from '../../models/photo'

export default async function main(uuid: string, lat: number, lon: number) {
  // first count how many times photos from this device were reported
  const abuseCount = await sql`SELECT COUNT(*)
              FROM "AbuseReports"
              INNER JOIN "Photos" on "AbuseReports"."photoId" = "Photos"."id"
              WHERE "Photos"."uuid" = ${uuid}
  `.count

  console.log(`count of abuse: ${abuseCount}`)
  if (abuseCount > 3) {
    throw "You are banned"
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const updatedAt = createdAt
  const watchedAt = createdAt

  const photo = (await sql`
                    insert into "Photos"
                    (
                        "uuid",
                        "location",
                        "likes",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      ${uuid},
                      ST_SetSRID(ST_MakePoint(${lat}, ${lon}), 4326),
                      0,
                      ${createdAt},
                      ${updatedAt}
                    )
                    returning *
                    `
                  )[0]

  const watcher =
  (await sql`
      insert into "Watchers"
      (
          "uuid",
          "photoId",
          "createdAt",
          "updatedAt",
          "watchedAt"
      ) values (
        ${uuid},
        ${photo.id},
        ${createdAt},
        ${updatedAt},
        ${watchedAt}
      )
      returning *
      `
    )[0]
    console.log({watcher})
  const ppp = plainToClass(Photo, photo)

  return ppp
}
