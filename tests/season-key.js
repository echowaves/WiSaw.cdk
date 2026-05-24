require('ts-node/register/transpile-only')

const { expect } = require('chai')
const { describe, it } = require('mocha')
const moment = require('moment')

const { getSeasonKey } = require('../lambda-fns/controllers/waves/_seasonKey.ts')
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
