require('ts-node/register/transpile-only')

const { expect } = require('chai')
const { describe, it } = require('mocha')
const moment = require('moment')

const { getSeasonKey, getSeasonBoundaries } = require('../lambda-fns/controllers/waves/_seasonKey.ts')
const { formatSeasonName } = require('../lambda-fns/controllers/waves/_seasonName.ts')

describe('getSeasonKey', () => {
  it('returns WINTER for December (same year)', () => {
    expect(getSeasonKey(moment('2025-12-15'))).to.equal('2025-WINTER')
  })

  it('returns WINTER for January (previous year)', () => {
    expect(getSeasonKey(moment('2026-01-15'))).to.equal('2025-WINTER')
  })

  it('returns WINTER for February (previous year)', () => {
    expect(getSeasonKey(moment('2026-02-28'))).to.equal('2025-WINTER')
  })

  it('returns SPRING for March', () => {
    expect(getSeasonKey(moment('2026-03-01'))).to.equal('2026-SPRING')
  })

  it('returns SPRING for April', () => {
    expect(getSeasonKey(moment('2026-04-10'))).to.equal('2026-SPRING')
  })

  it('returns SPRING for May', () => {
    expect(getSeasonKey(moment('2026-05-31'))).to.equal('2026-SPRING')
  })

  it('returns SUMMER for June', () => {
    expect(getSeasonKey(moment('2026-06-01'))).to.equal('2026-SUMMER')
  })

  it('returns SUMMER for July', () => {
    expect(getSeasonKey(moment('2026-07-22'))).to.equal('2026-SUMMER')
  })

  it('returns SUMMER for August', () => {
    expect(getSeasonKey(moment('2026-08-15'))).to.equal('2026-SUMMER')
  })

  it('returns FALL for September', () => {
    expect(getSeasonKey(moment('2026-09-01'))).to.equal('2026-FALL')
  })

  it('returns FALL for October', () => {
    expect(getSeasonKey(moment('2026-10-05'))).to.equal('2026-FALL')
  })

  it('returns FALL for November', () => {
    expect(getSeasonKey(moment('2026-11-30'))).to.equal('2026-FALL')
  })

  it('handles year boundary: Dec 2024 and Jan 2025 same season', () => {
    expect(getSeasonKey(moment('2024-12-31'))).to.equal('2024-WINTER')
    expect(getSeasonKey(moment('2025-01-01'))).to.equal('2024-WINTER')
    expect(getSeasonKey(moment('2025-02-28'))).to.equal('2024-WINTER')
  })

  it('handles different year: Dec 2023 is 2023-WINTER', () => {
    expect(getSeasonKey(moment('2023-12-01'))).to.equal('2023-WINTER')
  })
})

describe('formatSeasonName', () => {
  it('formats WINTER', () => {
    expect(formatSeasonName('2025-WINTER')).to.equal('Winter 2025')
  })

  it('formats SPRING', () => {
    expect(formatSeasonName('2026-SPRING')).to.equal('Spring 2026')
  })

  it('formats SUMMER', () => {
    expect(formatSeasonName('2026-SUMMER')).to.equal('Summer 2026')
  })

  it('formats FALL', () => {
    expect(formatSeasonName('2026-FALL')).to.equal('Fall 2026')
  })
})

describe('coordinateFallbackName logic (null island prevention)', () => {
  // Mirrors the coordinateFallbackName function from autoGroupPhotosIntoWaves.ts
  // Can't import directly due to psql module PEM cert dependency
  function coordinateFallbackName (lat, lon, seasonKey) {
    if (lat != null && lon != null) {
      const latDir = lat >= 0 ? 'N' : 'S'
      const lonDir = lon >= 0 ? 'E' : 'W'
      const coords = `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`
      return `${coords}, ${formatSeasonName(seasonKey)}`
    }
    return `Unlocated, ${formatSeasonName(seasonKey)}`
  }

  it('uses actual coordinates when available', () => {
    expect(coordinateFallbackName(42.3, -71.1, '2025-WINTER'))
      .to.equal('42.3°N, 71.1°W, Winter 2025')
  })

  it('never produces 0.0°N, 0.0°E for null coordinates', () => {
    const name = coordinateFallbackName(null, null, '2025-WINTER')
    expect(name).to.equal('Unlocated, Winter 2025')
    expect(name).to.not.include('0.0°')
  })

  it('handles southern/eastern hemisphere', () => {
    expect(coordinateFallbackName(-33.9, 18.4, '2026-SUMMER'))
      .to.equal('33.9°S, 18.4°E, Summer 2026')
  })

  it('handles partial null (only lat null)', () => {
    const name = coordinateFallbackName(null, -71.1, '2025-WINTER')
    expect(name).to.equal('Unlocated, Winter 2025')
  })

  it('handles partial null (only lon null)', () => {
    const name = coordinateFallbackName(42.3, null, '2025-WINTER')
    expect(name).to.equal('Unlocated, Winter 2025')
  })
})

describe('getSeasonBoundaries', () => {
  it('returns correct boundaries for SPRING', () => {
    const { splashDate, freezeDate } = getSeasonBoundaries('2026-SPRING')
    expect(splashDate).to.equal('2026-03-01 00:00:00.000')
    expect(freezeDate).to.equal('2026-05-31 23:59:59.999')
  })

  it('returns correct boundaries for SUMMER', () => {
    const { splashDate, freezeDate } = getSeasonBoundaries('2026-SUMMER')
    expect(splashDate).to.equal('2026-06-01 00:00:00.000')
    expect(freezeDate).to.equal('2026-08-31 23:59:59.999')
  })

  it('returns correct boundaries for FALL', () => {
    const { splashDate, freezeDate } = getSeasonBoundaries('2026-FALL')
    expect(splashDate).to.equal('2026-09-01 00:00:00.000')
    expect(freezeDate).to.equal('2026-11-30 23:59:59.999')
  })

  it('returns correct boundaries for WINTER (spans year boundary)', () => {
    const { splashDate, freezeDate } = getSeasonBoundaries('2025-WINTER')
    expect(splashDate).to.equal('2025-12-01 00:00:00.000')
    expect(freezeDate).to.equal('2026-02-28 23:59:59.999')
  })

  it('handles leap year for WINTER freeze date', () => {
    const { splashDate, freezeDate } = getSeasonBoundaries('2027-WINTER')
    expect(splashDate).to.equal('2027-12-01 00:00:00.000')
    // 2028 is a leap year
    expect(freezeDate).to.equal('2028-02-29 23:59:59.999')
  })
})
