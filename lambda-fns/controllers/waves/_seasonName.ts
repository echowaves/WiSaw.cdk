const SEASON_DISPLAY: Record<string, string> = {
  WINTER: 'Winter',
  SPRING: 'Spring',
  SUMMER: 'Summer',
  FALL: 'Fall'
}

export function formatSeasonName (seasonKey: string): string {
  const [year, season] = seasonKey.split('-')
  const display = SEASON_DISPLAY[season] ?? season
  return `${display} ${year}`
}
