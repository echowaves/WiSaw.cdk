import moment from 'moment'

type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'

const MONTH_TO_SEASON: Record<number, Season> = {
  0: 'WINTER', // Jan
  1: 'WINTER', // Feb
  2: 'SPRING', // Mar
  3: 'SPRING', // Apr
  4: 'SPRING', // May
  5: 'SUMMER', // Jun
  6: 'SUMMER', // Jul
  7: 'SUMMER', // Aug
  8: 'FALL', // Sep
  9: 'FALL', // Oct
  10: 'FALL', // Nov
  11: 'WINTER' // Dec
}

export function getSeasonKey (date: moment.Moment): string {
  const month = date.month() // 0-indexed
  const year = date.year()
  const season = MONTH_TO_SEASON[month]

  // For Jan/Feb, winter started in the previous year
  const seasonYear = (month === 0 || month === 1) ? year - 1 : year

  return `${seasonYear}-${season}`
}

const SEASON_START_MONTH: Record<Season, number> = {
  WINTER: 11, // Dec (0-indexed)
  SPRING: 2, // Mar
  SUMMER: 5, // Jun
  FALL: 8 // Sep
}

const SEASON_END_MONTH: Record<Season, number> = {
  WINTER: 1, // Feb (0-indexed)
  SPRING: 4, // May
  SUMMER: 7, // Aug
  FALL: 10 // Nov
}

export function getSeasonBoundaries (seasonKey: string): { splashDate: string, freezeDate: string } {
  const [yearStr, season] = seasonKey.split('-') as [string, Season]
  const year = parseInt(yearStr, 10)

  const startMonth = SEASON_START_MONTH[season]
  const startYear = season === 'WINTER' ? year : year
  const splashDate = moment({ year: startYear, month: startMonth, day: 1 })
    .startOf('day')
    .format('YYYY-MM-DD HH:mm:ss.SSS')

  const endMonth = SEASON_END_MONTH[season]
  const endYear = season === 'WINTER' ? year + 1 : year
  const freezeDate = moment({ year: endYear, month: endMonth, day: 1 })
    .endOf('month')
    .format('YYYY-MM-DD HH:mm:ss.SSS')

  return { splashDate, freezeDate }
}
