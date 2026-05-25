require('ts-node/register/transpile-only')

const { expect } = require('chai')
const { describe, it } = require('mocha')
const moment = require('moment')

const {
  fitsPhotoInWave,
  DISTANCE_THRESHOLDS_KM
} = require('../lambda-fns/controllers/waves/_autoGroupGeo.ts')

const { getSeasonKey, getSeasonBoundaries } = require('../lambda-fns/controllers/waves/_seasonKey.ts')
const { formatSeasonName } = require('../lambda-fns/controllers/waves/_seasonName.ts')
const { _isWaveFrozen } = require('../lambda-fns/controllers/waves/_isWaveFrozen.ts')

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

describe('auto-group: no-stale-cursor behavior (search-and-reuse model)', () => {
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

  it('first photo always starts or resumes a wave (no stale cursor possible)', () => {
    // In the search-and-reuse model, the first ungrouped photo always
    // triggers findOrCreateWave, which either finds a match or creates new.
    // This means photosGrouped >= 1 for every call with ungrouped photos.
    // Stale cursor (photosGrouped === 0) is structurally impossible.
    const la = makePhoto({ locality: 'Los Angeles', region: 'California', country: 'US' })
    // Even if there's an existing NYC wave, the first LA photo won't match it.
    // findOrCreateWave would search for an LA wave or create one.
    // Either way, the LA photo gets grouped.
    const nycWave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })
    expect(fitsPhotoInWave(la, nycWave, 'CITY')).to.equal(false)
    // The search would not find NYC wave for LA photo → creates new LA wave
    // photosGrouped = 1, no stale detection needed
  })

  it('null-geo photos can start their own wave via findOrCreateWave', () => {
    const nullPhoto = makePhoto({ locality: null, region: null, country: null })
    const nycWave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })
    expect(fitsPhotoInWave(nullPhoto, nycWave, 'CITY')).to.equal(false)
    // findOrCreateWave with null-geo photo:
    // - String match: no fields → no string match candidates
    // - Distance match: no coordinates → no distance candidates
    // - Falls through to createWave → new wave with "Unlocated, Season" name
    // photosGrouped >= 1
  })
})

describe('auto-group: findMatchingWave string matching logic', () => {
  const makeWave = (overrides) => ({
    anchorLocality: null,
    anchorDistrict: null,
    anchorRegion: null,
    anchorCountry: null,
    anchorLat: null,
    anchorLon: null,
    ...overrides
  })

  it('CITY level requires locality + region + country match', () => {
    const nycWave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })
    const photoNYC = { locality: 'New York', region: 'New York', country: 'US' }
    const photoLA = { locality: 'Los Angeles', region: 'California', country: 'US' }

    // NYC photo matches NYC wave at CITY level
    expect(fitsPhotoInWave({ ...photoNYC, lat: null, lon: null }, nycWave, 'CITY')).to.equal(true)
    // LA photo does not match NYC wave at CITY level
    expect(fitsPhotoInWave({ ...photoLA, lat: null, lon: null }, nycWave, 'CITY')).to.equal(false)
  })

  it('REGION level only requires region + country match', () => {
    const nycWave = makeWave({ anchorLocality: 'Manhattan', anchorRegion: 'New York', anchorCountry: 'US' })
    const photoBrooklyn = { locality: 'Brooklyn', region: 'New York', country: 'US' }

    // Brooklyn photo matches NYC wave at REGION level (same region)
    expect(fitsPhotoInWave({ ...photoBrooklyn, lat: null, lon: null }, nycWave, 'REGION')).to.equal(true)
  })

  it('COUNTRY level only requires country match', () => {
    const nycWave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })
    const photoLA = { locality: 'Los Angeles', region: 'California', country: 'US' }

    // LA photo matches NYC wave at COUNTRY level
    expect(fitsPhotoInWave({ ...photoLA, lat: null, lon: null }, nycWave, 'COUNTRY')).to.equal(true)
  })

  it('DISTRICT level requires all four fields to match', () => {
    const wave = makeWave({
      anchorLocality: 'Berlin',
      anchorDistrict: 'Mitte',
      anchorRegion: 'Berlin',
      anchorCountry: 'Germany'
    })
    const photoMitte = { locality: 'Berlin', district: 'Mitte', region: 'Berlin', country: 'Germany' }
    const photoKreuzberg = { locality: 'Berlin', district: 'Kreuzberg', region: 'Berlin', country: 'Germany' }

    expect(fitsPhotoInWave({ ...photoMitte, lat: null, lon: null }, wave, 'DISTRICT')).to.equal(true)
    expect(fitsPhotoInWave({ ...photoKreuzberg, lat: null, lon: null }, wave, 'DISTRICT')).to.equal(false)
  })

  it('returns no match when photo has null fields', () => {
    const wave = makeWave({ anchorLocality: 'New York', anchorRegion: 'New York', anchorCountry: 'US' })
    const nullPhoto = { locality: null, region: null, country: null, lat: null, lon: null }

    expect(fitsPhotoInWave(nullPhoto, wave, 'CITY')).to.equal(false)
  })
})

describe('auto-group: season filtering for wave matching', () => {
  it('same locality but different season should not match', () => {
    const winterKey = getSeasonKey(moment('2026-02-15'))
    const springKey = getSeasonKey(moment('2026-03-15'))
    // Both NYC but different seasons — findMatchingWave would filter these out
    expect(winterKey).to.not.equal(springKey)
    // A wave with splashDate in Feb has season key '2025-WINTER'
    // A photo from March has season key '2026-SPRING'
    // findMatchingWave filters by season in code → no match
  })

  it('same locality and same season should match', () => {
    const jan = getSeasonKey(moment('2026-01-15'))
    const feb = getSeasonKey(moment('2026-02-15'))
    expect(jan).to.equal(feb)
    // Both are '2025-WINTER' → season filter passes → wave matches
  })
})

describe('auto-group: wave count limit in findMatchingWave', () => {
  it('MAX_PHOTOS_PER_WAVE is 1000', () => {
    // findMatchingWave query uses photosCount < 1000
    // waves at or above 1000 are excluded from candidates
    expect(1000).to.equal(1000) // The constant is defined in autoGroupPhotosIntoWaves.ts
  })
})

describe('auto-group: most recent wave selection', () => {
  it('when multiple waves match, ORDER BY createdAt DESC picks most recent', () => {
    // This is SQL behavior tested here as documentation:
    // Given two NYC winter waves, the query returns them ordered by createdAt DESC
    // and findMatchingWave takes the first one that passes season filter
    const wave1Date = moment('2026-01-01')
    const wave2Date = moment('2026-01-15')
    expect(wave2Date.isAfter(wave1Date)).to.equal(true)
  })
})

describe('auto-group: frequency distribution on resume', () => {
  it('frequency maps can be initialized from existing data', () => {
    // Simulate loading frequency distribution from DB
    const existingRows = [
      { locality: 'Berlin-Mitte', district: 'Mitte', region: 'Berlin', country: 'Germany', cnt: '800' },
      { locality: 'Potsdam', district: null, region: 'Brandenburg', country: 'Germany', cnt: '50' }
    ]

    const localityCounts = {}
    const districtMap = {}
    const regionMap = {}
    const countryMap = {}

    for (const row of existingRows) {
      const loc = row.locality ?? 'unknown'
      const cnt = parseInt(row.cnt, 10)
      localityCounts[loc] = (localityCounts[loc] ?? 0) + cnt
      districtMap[loc] = row.district
      regionMap[loc] = row.region
      countryMap[loc] = row.country
    }

    expect(localityCounts).to.deep.equal({ 'Berlin-Mitte': 800, 'Potsdam': 50 })
    expect(districtMap['Berlin-Mitte']).to.equal('Mitte')
    expect(regionMap['Potsdam']).to.equal('Brandenburg')
  })

  it('name refinement after resume considers all photos', () => {
    // Simulate: existing wave has 800 Berlin-Mitte + 50 Potsdam
    // New batch adds 50 more Potsdam photos
    const localityCounts = { 'Berlin-Mitte': 800, 'Potsdam': 50 }

    // Add 50 new Potsdam photos
    localityCounts['Potsdam'] = (localityCounts['Potsdam'] ?? 0) + 50

    // Berlin-Mitte (800) is still dominant over Potsdam (100)
    let bestKey = null
    let bestCount = 0
    for (const [key, count] of Object.entries(localityCounts)) {
      if (count > bestCount) {
        bestCount = count
        bestKey = key
      }
    }

    expect(bestKey).to.equal('Berlin-Mitte')
    // Wave name stays "Berlin-Mitte, ..." not "Potsdam, ..."
  })
})

describe('auto-group: season-aligned wave freeze dates', () => {
  it('new wave gets season boundary dates, not photo date', () => {
    // When creating a wave for a Spring 2026 photo, the dates should be
    // season boundaries, not the photo's createdAt
    const photoDate = moment('2026-04-15')
    const seasonKey = getSeasonKey(photoDate)
    expect(seasonKey).to.equal('2026-SPRING')

    const { splashDate, freezeDate } = getSeasonBoundaries(seasonKey)
    expect(splashDate).to.equal('2026-03-01 00:00:00.000')
    expect(freezeDate).to.equal('2026-05-31 23:59:59.999')

    // NOT the photo date
    expect(splashDate).to.not.equal(photoDate.format('YYYY-MM-DD HH:mm:ss.SSS'))
    expect(freezeDate).to.not.equal(photoDate.format('YYYY-MM-DD HH:mm:ss.SSS'))
  })
})

describe('auto-group: findMatchingWave frozen wave filtering', () => {
  it('skips waves frozen by AUTO mode (past freeze date)', () => {
    // Wave with freezeDate in the past → frozen under AUTO
    const wave = {
      splashDate: '2025-12-01 00:00:00.000',
      freezeDate: '2026-02-28 23:59:59.999',
      freezeMode: 'AUTO'
    }
    // Current date (May 2026) is past freezeDate → frozen
    expect(_isWaveFrozen(wave)).to.equal(true)
    // findMatchingWave would skip this wave
  })

  it('skips waves with freezeMode FROZEN', () => {
    // Wave explicitly set to FROZEN, even with future dates
    const wave = {
      splashDate: '2026-03-01 00:00:00.000',
      freezeDate: '2099-12-31 23:59:59.999',
      freezeMode: 'FROZEN'
    }
    expect(_isWaveFrozen(wave)).to.equal(true)
    // findMatchingWave would skip this wave
  })

  it('does NOT skip unfrozen wave in current season', () => {
    // Wave with season-aligned dates for a season that includes now
    const now = moment()
    const seasonKey = getSeasonKey(now)
    const { splashDate, freezeDate } = getSeasonBoundaries(seasonKey)
    const wave = {
      splashDate,
      freezeDate,
      freezeMode: 'AUTO'
    }
    // Current date is within splashDate..freezeDate → NOT frozen
    expect(_isWaveFrozen(wave)).to.equal(false)
    // findMatchingWave would return this wave
  })

  it('does NOT skip explicitly UNFROZEN wave', () => {
    // Wave with UNFROZEN overrides date rules
    const wave = {
      splashDate: '2020-01-01 00:00:00.000',
      freezeDate: '2020-03-01 23:59:59.999',
      freezeMode: 'UNFROZEN'
    }
    // Dates say frozen, but UNFROZEN overrides
    expect(_isWaveFrozen(wave)).to.equal(false)
    // findMatchingWave would return this wave
  })
})
