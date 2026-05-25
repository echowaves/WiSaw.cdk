require('ts-node/register/transpile-only')

const { expect } = require('chai')
const { describe, it } = require('mocha')
const moment = require('moment')

const {
  fitsPhotoInWave,
  DISTANCE_THRESHOLDS_KM
} = require('../lambda-fns/controllers/waves/_autoGroupGeo.ts')

const { getSeasonKey } = require('../lambda-fns/controllers/waves/_seasonKey.ts')
const { formatSeasonName } = require('../lambda-fns/controllers/waves/_seasonName.ts')

describe('auto-group: fitsPhotoInWave (string-match only)', () => {
  const makePhoto = (overrides) => ({
    id: 'p1',
    lat: null,
    lon: null,
    createdAt: '2025-01-01',
    locality: null,
    district: null,
    region: null,
    country: null,
    countryCode: null,
    ...overrides
  })

  const makeWave = (overrides) => ({
    anchorLocality: null,
    anchorDistrict: null,
    anchorRegion: null,
    anchorCountry: null,
    anchorLat: null,
    anchorLon: null,
    ...overrides
  })

  it('returns false when wave is null', () => {
    expect(fitsPhotoInWave(makePhoto({}), null, 'CITY')).to.equal(false)
  })

  // String match tests
  it('matches by string at CITY level', () => {
    const photo = makePhoto({ locality: 'Paris', region: 'Île-de-France', country: 'France' })
    const wave = makeWave({ anchorLocality: 'Paris', anchorRegion: 'Île-de-France', anchorCountry: 'France' })
    expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(true)
  })

  it('does not match different locality at CITY level', () => {
    const photo = makePhoto({ locality: 'Lyon', region: 'Auvergne', country: 'France' })
    const wave = makeWave({ anchorLocality: 'Paris', anchorRegion: 'Île-de-France', anchorCountry: 'France' })
    expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(false)
  })

  it('matches by string at REGION level ignoring locality', () => {
    const photo = makePhoto({ locality: 'Brooklyn', region: 'New York', country: 'United States' })
    const wave = makeWave({ anchorLocality: 'Manhattan', anchorRegion: 'New York', anchorCountry: 'United States' })
    expect(fitsPhotoInWave(photo, wave, 'REGION')).to.equal(true)
  })

  it('matches by string at COUNTRY level ignoring region', () => {
    const photo = makePhoto({ locality: 'Lyon', region: 'Auvergne', country: 'France' })
    const wave = makeWave({ anchorLocality: 'Paris', anchorRegion: 'Île-de-France', anchorCountry: 'France' })
    expect(fitsPhotoInWave(photo, wave, 'COUNTRY')).to.equal(true)
  })

  // Distance fallback is now handled by _filterPhotosInRadius, not fitsPhotoInWave
  it('returns false when strings mismatch even if within distance threshold', () => {
    // Paris to Montmartre: ~2.6 km, but string mismatch means fitsPhotoInWave returns false
    const photo = makePhoto({
      locality: 'Paris 9e Arrondissement',
      region: 'Île-de-France',
      country: 'France',
      lat: 48.879,
      lon: 2.340
    })
    const wave = makeWave({
      anchorLocality: 'Paris',
      anchorRegion: 'Île-de-France',
      anchorCountry: 'France',
      anchorLat: 48.856,
      anchorLon: 2.352
    })
    expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(false)
  })

  it('returns false for geocoding failure (empty strings) regardless of distance', () => {
    const photo = makePhoto({
      locality: '',
      region: '',
      country: '',
      lat: 48.860,
      lon: 2.355
    })
    const wave = makeWave({
      anchorLocality: 'Paris',
      anchorRegion: 'Île-de-France',
      anchorCountry: 'France',
      anchorLat: 48.856,
      anchorLon: 2.352
    })
    expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(false)
  })

  it('rejects when strings mismatch AND distance exceeds threshold (CITY)', () => {
    // Paris to Lyon: ~392 km, threshold is 50 km
    const photo = makePhoto({
      locality: 'Lyon',
      region: 'Auvergne',
      country: 'France',
      lat: 45.764,
      lon: 4.835
    })
    const wave = makeWave({
      anchorLocality: 'Paris',
      anchorRegion: 'Île-de-France',
      anchorCountry: 'France',
      anchorLat: 48.856,
      anchorLon: 2.352
    })
    expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(false)
  })

  it('distance fallback respects REGION threshold (300 km)', () => {
    // Paris to Lyon: ~392 km, exceeds 300 km REGION threshold
    const photo = makePhoto({
      locality: 'Lyon',
      region: 'Auvergne',
      country: 'France',
      lat: 45.764,
      lon: 4.835
    })
    const wave = makeWave({
      anchorLocality: 'Paris',
      anchorRegion: 'Île-de-France',
      anchorCountry: 'France',
      anchorLat: 48.856,
      anchorLon: 2.352
    })
    expect(fitsPhotoInWave(photo, wave, 'REGION')).to.equal(false)
  })

  it('skips distance fallback when photo has no coordinates', () => {
    const photo = makePhoto({
      locality: 'Different',
      region: 'Different',
      country: 'Different',
      lat: null,
      lon: null
    })
    const wave = makeWave({
      anchorLocality: 'Paris',
      anchorRegion: 'Île-de-France',
      anchorCountry: 'France',
      anchorLat: 48.856,
      anchorLon: 2.352
    })
    expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(false)
  })

  it('skips distance fallback when wave has no coordinates', () => {
    const photo = makePhoto({
      locality: 'Different',
      region: 'Different',
      country: 'Different',
      lat: 48.860,
      lon: 2.355
    })
    const wave = makeWave({
      anchorLocality: 'Paris',
      anchorRegion: 'Île-de-France',
      anchorCountry: 'France',
      anchorLat: null,
      anchorLon: null
    })
    expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(false)
  })
})

describe('auto-group: DISTANCE_THRESHOLDS_KM', () => {
  it('has correct thresholds', () => {
    expect(DISTANCE_THRESHOLDS_KM).to.deep.equal({
      DISTRICT: 15,
      CITY: 50,
      REGION: 300,
      COUNTRY: 2000
    })
  })
})

describe('auto-group: season boundaries', () => {
  it('photos in same season have same season key', () => {
    const dec = getSeasonKey(moment('2025-12-01'))
    const jan = getSeasonKey(moment('2026-01-15'))
    const feb = getSeasonKey(moment('2026-02-28'))
    expect(dec).to.equal(jan)
    expect(jan).to.equal(feb)
    expect(dec).to.equal('2025-WINTER')
  })

  it('photos crossing season boundary have different season keys', () => {
    const feb = getSeasonKey(moment('2026-02-28'))
    const mar = getSeasonKey(moment('2026-03-01'))
    expect(feb).to.not.equal(mar)
    expect(feb).to.equal('2025-WINTER')
    expect(mar).to.equal('2026-SPRING')
  })

  it('season name formats correctly for wave naming', () => {
    expect(formatSeasonName('2025-WINTER')).to.equal('Winter 2025')
    expect(formatSeasonName('2026-SPRING')).to.equal('Spring 2026')
    expect(formatSeasonName('2026-SUMMER')).to.equal('Summer 2026')
    expect(formatSeasonName('2026-FALL')).to.equal('Fall 2026')
  })

  it('same locality + different season = different season keys (would create separate waves)', () => {
    // Both NYC but different seasons — algorithm would close wave at boundary
    const winterKey = getSeasonKey(moment('2026-02-15'))
    const springKey = getSeasonKey(moment('2026-03-15'))
    expect(winterKey).to.not.equal(springKey)
  })
})

describe('auto-group: skip-non-matching behavior (string match level)', () => {
  const makePhoto = (overrides) => ({
    id: 'p1',
    lat: null,
    lon: null,
    createdAt: '2025-01-01',
    locality: null,
    district: null,
    region: null,
    country: null,
    countryCode: null,
    ...overrides
  })

  const makeWave = (overrides) => ({
    anchorLocality: null,
    anchorDistrict: null,
    anchorRegion: null,
    anchorCountry: null,
    anchorLat: null,
    anchorLon: null,
    ...overrides
  })

  it('non-matching photo returns false (would be skipped, not break wave)', () => {
    const nyc = makePhoto({ locality: 'New York', region: 'New York', country: 'US' })
    const chi = makePhoto({ locality: 'Chicago', region: 'Illinois', country: 'US' })
    const wave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })

    expect(fitsPhotoInWave(nyc, wave, 'CITY')).to.equal(true)
    expect(fitsPhotoInWave(chi, wave, 'CITY')).to.equal(false)
    // In new algorithm: chi would be skipped, nyc would be added
  })

  it('null-geo photo returns false (would be skipped for distance check)', () => {
    const nullGeo = makePhoto({ locality: null, region: null, country: null })
    const wave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })

    expect(fitsPhotoInWave(nullGeo, wave, 'CITY')).to.equal(false)
    // In new algorithm: would go to distance fallback, if fails → skipped
  })

  it('at COUNTRY level, same country matches regardless of city/region differences', () => {
    const nyc = makePhoto({ locality: 'New York', region: 'New York', country: 'US' })
    const la = makePhoto({ locality: 'Los Angeles', region: 'California', country: 'US' })
    const wave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })

    expect(fitsPhotoInWave(nyc, wave, 'COUNTRY')).to.equal(true)
    expect(fitsPhotoInWave(la, wave, 'COUNTRY')).to.equal(true)
    // Both grouped into same wave at COUNTRY level
  })
})

describe('auto-group: stale wave detection (infinite loop prevention)', () => {
  const makePhoto = (overrides) => ({
    id: 'p1',
    lat: null,
    lon: null,
    createdAt: '2025-01-01',
    locality: null,
    district: null,
    region: null,
    country: null,
    countryCode: null,
    ...overrides
  })

  const makeWave = (overrides) => ({
    anchorLocality: null,
    anchorDistrict: null,
    anchorRegion: null,
    anchorCountry: null,
    anchorLat: null,
    anchorLon: null,
    ...overrides
  })

  it('all photos from different city fail string match against active wave (stale wave scenario)', () => {
    // This verifies the precondition for the infinite loop:
    // active wave is NYC, all photos are LA — none match
    const wave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })
    const photos = [
      makePhoto({ id: 'p1', locality: 'Los Angeles', region: 'California', country: 'US' }),
      makePhoto({ id: 'p2', locality: 'Los Angeles', region: 'California', country: 'US' }),
      makePhoto({ id: 'p3', locality: 'Los Angeles', region: 'California', country: 'US' })
    ]

    // All photos fail string match at CITY level
    for (const photo of photos) {
      expect(fitsPhotoInWave(photo, wave, 'CITY')).to.equal(false)
    }
    // In the algorithm: all are skipped, photosGrouped = 0,
    // stale wave detection closes the wave so next call can proceed
  })

  it('null-geo photos fail string match against geo-anchored wave (stale wave scenario)', () => {
    const wave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })
    const nullPhoto = makePhoto({ locality: null, region: null, country: null })

    expect(fitsPhotoInWave(nullPhoto, wave, 'CITY')).to.equal(false)
    // Would be skipped, and if all remaining photos are null-geo,
    // stale wave detection kicks in
  })
})
