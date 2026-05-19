import type { Address } from '@aws-sdk/client-geo-places'

export interface GeocodeResult {
  locality: string | null
  district: string | null
  region: string | null
  country: string | null
  countryCode: string | null
}

export function mapGeocodeResult (addr: Address): GeocodeResult {
  return {
    locality: addr.Locality ?? null,
    district: addr.District ?? null,
    region: addr.Region?.Name ?? null,
    country: addr.Country?.Name ?? null,
    countryCode: addr.Country?.Code2 ?? null,
      }
}

export function defaultToEmpty (result: GeocodeResult): GeocodeResult {
  return {
    locality: result.locality ?? '',
    district: result.district ?? '',
    region: result.region ?? '',
    country: result.country ?? '',
    countryCode: result.countryCode ?? '',
      }
}
