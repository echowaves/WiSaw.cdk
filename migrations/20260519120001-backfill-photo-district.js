'use strict'

const { GeoPlacesClient, ReverseGeocodeCommand } = require('@aws-sdk/client-geo-places')

const BATCH_SIZE = 1000
const geoClient = new GeoPlacesClient({})

function mapGeocodeResult (addr) {
  return {
    locality: addr.Locality ?? null,
    district: addr.District ?? null,
    localityLevel: (addr.Locality != null) ? 'locality' : ((addr.District != null) ? 'district' : null),
    region: addr.Region?.Name ?? null,
    country: addr.Country?.Name ?? null,
    countryCode: addr.Country?.Code2 ?? null,
     }
}

async function reverseGeocode (lat, lon) {
  try {
    const command = new ReverseGeocodeCommand({
      QueryPosition: [lon, lat],
      Language: 'en',
      MaxResults: 1,
        })
    const response = await geoClient.send(command)
    const item = response.ResultItems?.[0]
    if (item?.Address != null) {
      return mapGeocodeResult(item.Address)
        }
    return null
     } catch {
    return null
     }
}

async function processBatch (sequelize, offset) {
  const photos = await sequelize.query(
     `SELECT id, ST_Y("location"::geometry) AS lat, ST_X("location"::geometry) AS lon
     FROM "Photos"
     WHERE "district" IS NULL
     ORDER BY "createdAt" ASC
     LIMIT :limit OFFSET :offset`,
     { type: sequelize.QueryTypes.SELECT, replacements: { limit: BATCH_SIZE, offset } },
      )

  if (photos.length === 0) return false

  for (const photo of photos) {
    const geo = await reverseGeocode(parseFloat(photo.lat), parseFloat(photo.lon))
    if (geo) {
      await sequelize.query(
          `UPDATE "Photos" SET "locality" = :locality, "district" = :district, "localityLevel" = :localityLevel, "region" = :region, "country" = :country, "countryCode" = :countryCode WHERE "id" = :id`,
          { replacements: { locality: geo.locality ?? '', district: geo.district ?? '', localityLevel: geo.localityLevel ?? '', region: geo.region ?? '', country: geo.country ?? '', countryCode: geo.countryCode ?? '', id: photo.id } },
          )
        } else {
      await sequelize.query(
          `UPDATE "Photos" SET "locality" = '', "district" = '', "localityLevel" = '', "region" = '', "country" = '', "countryCode" = '' WHERE "id" = :id`,
          { replacements: { id: photo.id } },
          )
        }
      }

  return photos.length === BATCH_SIZE
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Migration: Backfill all locality fields for existing Photos')
    const sequelize = queryInterface.sequelize
    let offset = 0
    let hasMore = true
    while (hasMore) {
      hasMore = await processBatch(sequelize, offset)
      offset += BATCH_SIZE
      console.log(`Processed ${offset} photos, hasMore: ${hasMore}`)
         }
    console.log('✅ Migration complete: Backfilled all locality fields for existing photos')
      },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rollback: Clear locality fields')
    const sequelize = queryInterface.sequelize
    await sequelize.query(`UPDATE "Photos" SET "locality" = NULL, "district" = NULL, "localityLevel" = NULL, "region" = NULL, "country" = NULL, "countryCode" = NULL WHERE "locality" IS NOT NULL`)
    console.log('✅ Rollback complete')
      },
}
