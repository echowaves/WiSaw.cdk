require('ts-node/register/transpile-only')

const { expect } = require('chai')
const { describe, it } = require('mocha')

const {
  fitsPhotoInWave,
  DISTANCE_THRESHOLDS_KM
} = require('../lambda-fns/controllers/waves/_autoGroupGeo.ts')

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
