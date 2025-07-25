import psql from "../../psql"

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");
// select distinct "watchersCount" from "Photos" order by "watchersCount" DESC;

export const _updateWatchers = async (photoId: string, uuid: string) => {
  await psql.connect()

  const count = (
    await psql.query(`
  UPDATE "Photos"
      SET "watchersCount" =
        (SELECT COUNT(id) as "watchersCount" from "Watchers" where "Watchers"."photoId" = $1
        AND "Watchers"."uuid" != "Photos"."uuid")
      WHERE id = $2
      returning *`, [photoId, photoId])
  ).rows[0]
  await psql.clean()

  return count.watchersCount
}
