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
 * Compute Haversine distance in km between two coordinate pairs.
 */
export function haversineKm (lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
 * Check if a photo fits into a wave based on the wave's groupingLevel
 * and anchor fields. Uses string matching first, then falls back to
 * spatial distance if both photo and anchor have valid coordinates.
 */
export function fitsPhotoInWave (
  photo: PhotoGeoFields,
  wave: any,
  groupingLevel: string
): boolean {
  if (wave == null) return false

  if (stringMatchesGroupingLevel(photo, wave, groupingLevel)) return true

  // Distance fallback: check if within threshold when both have coordinates
  const anchorLat: number | null = wave.anchorLat ?? null
  const anchorLon: number | null = wave.anchorLon ?? null
  if (photo.lat != null && photo.lon != null && anchorLat != null && anchorLon != null) {
    const threshold = DISTANCE_THRESHOLDS_KM[groupingLevel]
    if (threshold != null) {
      return haversineKm(photo.lat, photo.lon, anchorLat, anchorLon) <= threshold
    }
  }

  return false
}
