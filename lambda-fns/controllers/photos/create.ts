import moment from 'moment'
import { v4 as uuidv4 } from 'uuid'
import { GeoPlacesClient, ReverseGeocodeCommand } from '@aws-sdk/client-geo-places'

import { plainToClass } from 'class-transformer'

import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'

import Photo from '../../models/photo'
import watch from './watch'

const client = new GeoPlacesClient({})

interface ReverseGeocodeResult {
  locality: string | null
  localityLevel: string | null
  region: string | null
  country: string | null
  countryCode: string | null
}

async function reverseGeocode (lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
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
      const addr = item.Address
      return {
        locality: addr.Locality ?? addr.District ?? null,
        localityLevel: (addr.Locality != null) ? 'locality' : ((addr.District != null) ? 'district' : null),
        region: addr.Region?.Name ?? null,
        country: addr.Country?.Name ?? null,
        countryCode: addr.Country?.Code2 ?? null,
       }
     }
    return null
   } catch (error) {
    console.error('Reverse geocode failed:', error)
    return null
   }
}

export default async function main (
  uuid: string,
  lat: number,
  lon: number,
  video: boolean,
) {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const abuseCount = (
    await psql.query(`
      SELECT COUNT(*)
              FROM "AbuseReports"
              INNER JOIN "Photos" on "AbuseReports"."photoId" = "Photos"."id"
              WHERE "Photos"."uuid" = $1
   `, [uuid])
   ).rows[0].count

  if (abuseCount > 3) {
    throw 'You are banned'
   }

  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  const updatedAt = createdAt
  const photoId = uuidv4()

  // Reverse geocode to get locality data
  const geo = await reverseGeocode(lat, lon)
  const locality = geo?.locality ?? ''
  const localityLevel = geo?.localityLevel ?? ''
  const region = geo?.region ?? ''
  const country = geo?.country ?? ''
  const countryCode = geo?.countryCode ?? ''

  const photo = (
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
                         "localityLevel",
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
                      `, [photoId, uuid, lat, lon, video ? true : false, createdAt, updatedAt, locality, localityLevel, region, country, countryCode])
   ).rows[0]
  await psql.clean()

  await watch(photo.id, uuid)

  return plainToClass(Photo, photo)
}
