import * as moment from 'moment'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Photo from '../../models/photo'
import watch from './watch'

export default async function main(uuid: string, lat: number, lon: number, video: boolean) {
  // first count how many times photos from this device were reported
  const abuseCount = (await sql`SELECT COUNT(*)
              FROM "AbuseReports"
              INNER JOIN "Photos" on "AbuseReports"."photoId" = "Photos"."id"
              WHERE "Photos"."uuid" = ${uuid}
  `)[0].count

  // console.log({abuseCount})

  if (abuseCount > 3) {
    throw "You are banned"
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const updatedAt = createdAt
  const watchedAt = createdAt

  const photo = (await sql`
                    INSERT INTO "Photos"
                    (
                        "uuid",
                        "location",
                        "video",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      ${uuid},
                      ST_MakePoint(${lat}, ${lon}),
                      ${video ? true: false}, 
                      ${createdAt},
                      ${updatedAt}
                    )
                    returning *
                    `
  )[0]

  await watch(photo.id, uuid)

  // console.log({watcher})
  return plainToClass(Photo, photo)
}
