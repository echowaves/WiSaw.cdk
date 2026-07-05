import dayjs, { type Dayjs } from 'dayjs'
import { GeoPlacesClient, ReverseGeocodeCommand } from '@aws-sdk/client-geo-places'

import { plainToClass } from 'class-transformer'

import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { mapGeocodeResult, defaultToEmpty, type GeocodeResult } from '../../utilities/geocodeResult'

import Photo from '../../models/photo'
import watch from './watch'

const client = new GeoPlacesClient({})

async function reverseGeocode (lat: number, lon: number): Promise<GeocodeResult | null> {
  try {
    const params = {
      QueryPosition: [lon, lat],
      Language: 'en' as const,
      MaxResults: 1,
         }
    const command = new ReverseGeocodeCommand(params)
    const response = await client.send(command)
    const item = response.ResultItems?.[0]
    if (item?.Address != null) {
      return mapGeocodeResult(item.Address)
         }
    return null
       } catch (error) {
    console.error('Reverse geocode failed:', error)
    return null
       }
    }

export default async function main (
  photoId: string,
  uuid: string,
  lat: number,
  lon: number,
  video: boolean,
) {
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Check abuse reports — but if photo already exists (idempotent), skip abuse check and return existing
  const abuseCount = (
    await psql.query(`
      SELECT COUNT(*)
              FROM "AbuseReports"
              INNER JOIN "Photos" on "AbuseReports"."photoId" = "Photos"."id"
              WHERE "Photos"."uuid" = $1
     `, [uuid])
     ).rows[0].count

  if (abuseCount > 3) {
    // Photo already exists? Return it (idempotent — skip abuse check)
    const existing = (
      await psql.query(`SELECT * FROM "Photos" WHERE "id" = $1`, [photoId])
     ).rows

    if (existing.length > 0) {
      await psql.clean()
      return plainToClass(Photo, existing[0])
    }

    throw 'You are banned'
  }

  const createdAt = dayjs().toISOString()
  const updatedAt = createdAt

  // Reverse geocode to get locality data
  const geo = await reverseGeocode(lat, lon)
  const geoFields = defaultToEmpty(geo ?? mapGeocodeResult({} as any))
  const locality = geoFields.locality
  const district = geoFields.district
  const region = geoFields.region
  const country = geoFields.country
  const countryCode = geoFields.countryCode

  let photo

  try {
    photo = (
      await psql.query(`
                    INSERT INTO "Photos"
                      (
                            "id",
                            "uuid",
                            "location",
                            "video",
                            "createdAt",
                            "updatedAt",
                            "locality",
                            "district",
                            "region",
                            "country",
                            "countryCode"
                       ) values (
                          $1,
                          $2,
                      ST_MakePoint($4, $3),
                          $5,
                          $6,
                          $7,
                          $8,
                          $9,
                          $10,
                          $11,
                          $12
                         )
                    returning *
                          `, [photoId, uuid, lat, lon, video, createdAt, updatedAt, locality, district, region, country, countryCode])
     ).rows[0]
    await psql.clean()

    await watch(photo.id, uuid)

    return plainToClass(Photo, photo)
  } catch (error: any) {
    // Handle UNIQUE constraint violation (error code 23505) — photo already exists
    if (error?.code === '23505') {
      // Photo was created concurrently — return existing (idempotent)
      const existing = (
        await psql.query(`SELECT * FROM "Photos" WHERE "id" = $1`, [photoId])
       ).rows

      if (existing.length > 0) {
        await psql.clean()
        return plainToClass(Photo, existing[0])
      }

      throw new Error(`Photo ${photoId} not found after UNIQUE violation`)
    }

    throw error
  }
}
