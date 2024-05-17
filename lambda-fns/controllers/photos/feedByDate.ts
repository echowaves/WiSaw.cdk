import moment from "moment"
import psql from "../../psql"

import { plainToClass } from "class-transformer"
import Photo from "../../models/photo"

async function _retrievePhotos(currentDate:any , daysAgo:any, lat:any , lon:any): Promise<any> {
  const results = (
    await psql.query(`
    SELECT
    *
    , ST_Distance(
        "location",
        ST_MakePoint(${lat}, ${lon})
      ) as distance
    , row_number()  OVER (ORDER BY "createdAt" DESC) + (100*${daysAgo}) as row_number
  
    FROM "Photos"
    WHERE
        "createdAt" >= '${currentDate
          .clone()
          .subtract(daysAgo, "days")
          .format("YYYY-MM-DD HH:mm:ss.SSS")}'
    AND "createdAt" <= '${currentDate
      .clone()
      .add(1, "days")
      .subtract(daysAgo, "days")
      .format("YYYY-MM-DD HH:mm:ss.SSS")}'
    AND active = true
    ORDER BY distance
    LIMIT 1000
    OFFSET 0
  `)
  ).rows
  // console.log({results})
  const photos = results.map((photo: any) => plainToClass(Photo, photo))
  // .sort((a: Photo, b: Photo) => moment(b.createdAt).diff(moment(a.createdAt)))
  
  return photos  
}


export default async function main(
  daysAgo: number,
  lat: number,
  lon: number,
  batch: string,
  whenToStop: string,
) {
  const currentDate = moment()
  const whenToStopDate = moment(whenToStop)
  
  await psql.connect()

  const [
    day0, 
    day1, 
    day2, 
    day3,
    day4, 
    day5, 
    day6, 
    day7,
    day8,
    day9,
  ] = await Promise.all([
    _retrievePhotos(currentDate, daysAgo * 3 + 0, lat , lon),
    _retrievePhotos(currentDate, daysAgo * 3 + 1, lat , lon),
    _retrievePhotos(currentDate, daysAgo * 3 + 2, lat , lon),    
    _retrievePhotos(currentDate, daysAgo * 3 + 3, lat , lon),    
    _retrievePhotos(currentDate, daysAgo * 3 + 4, lat , lon),
    _retrievePhotos(currentDate, daysAgo * 3 + 5, lat , lon),
    _retrievePhotos(currentDate, daysAgo * 3 + 6, lat , lon),    
    _retrievePhotos(currentDate, daysAgo * 3 + 7, lat , lon),
    _retrievePhotos(currentDate, daysAgo * 3 + 8, lat , lon),
    _retrievePhotos(currentDate, daysAgo * 3 + 9, lat , lon),    
  ])

  await psql.clean()

  const photos = [
    ...day0, 
    ...day1, 
    ...day2, 
    ...day3,
    ...day4, 
    ...day5, 
    ...day6, 
    ...day7, 
    ...day8, 
    ...day9, 
  ]

  let noMoreData = false

  if (currentDate.clone().subtract(daysAgo, "days").diff(whenToStopDate) < 0) {
    noMoreData = true
  }

  return {
    photos,
    batch,
    noMoreData,
  }
}
