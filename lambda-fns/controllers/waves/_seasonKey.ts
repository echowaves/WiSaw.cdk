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
