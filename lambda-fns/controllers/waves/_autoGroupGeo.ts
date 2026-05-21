export interface PhotoGeoFields {
  lat: number | null
  lon: number | null
  locality: string | null
  district: string | null
  region: string | null
  country: string | null
}

export const DISTANCE_THRESHOLDS_KM: Record<string, number> = {
  DISTRICT: 15,
  CITY: 50,
  REGION: 300,
  COUNTRY: 2000
}

/**
 * Normalize a geographic value: treat null and empty string as equivalent.
 */
export function normalizeGeo (val: string | null): string | null {
  return val == null || val === '' ? null : val
}

/**
 * Check if two locations match by string fields for the given grouping level.
 */
function stringMatchesGroupingLevel (
  photo: PhotoGeoFields,
  wave: any,
  groupingLevel: string
): boolean {
  const anchorLocality = normalizeGeo(wave.anchorLocality)
  const anchorDistrict = normalizeGeo(wave.anchorDistrict)
  const anchorRegion = normalizeGeo(wave.anchorRegion)
  const anchorCountry = normalizeGeo(wave.anchorCountry)

  const photoLocality = normalizeGeo(photo.locality)
  const photoDistrict = normalizeGeo(photo.district)
  const photoRegion = normalizeGeo(photo.region)
  const photoCountry = normalizeGeo(photo.country)

  switch (groupingLevel) {
    case 'DISTRICT':
      return photoDistrict === anchorDistrict &&
             photoLocality === anchorLocality &&
             photoRegion === anchorRegion &&
             photoCountry === anchorCountry
    case 'CITY':
      return photoLocality === anchorLocality &&
             photoRegion === anchorRegion &&
             photoCountry === anchorCountry
    case 'REGION':
      return photoRegion === anchorRegion &&
             photoCountry === anchorCountry
    case 'COUNTRY':
      return photoCountry === anchorCountry
    default:
      return false
  }
}

/**
 * Check if a photo fits into a wave based on string-matching only.
 * Distance fallback is handled separately via _filterPhotosInRadius.
 */
export function fitsPhotoInWave (
  photo: PhotoGeoFields,
  wave: any,
  groupingLevel: string
): boolean {
  if (wave == null) return false

  return stringMatchesGroupingLevel(photo, wave, groupingLevel)
}
