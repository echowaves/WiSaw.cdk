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
  
  const arraySize = 10
  // call _retrievePhotos 10 times for 10 conscutive days in parallel
  const photos = (
    await Promise.all(
                        [...Array(arraySize)].map((_, i) => _retrievePhotos(currentDate, daysAgo * arraySize + i, lat , lon))    
                      )
  ).flat(1)

  await psql.clean()


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
