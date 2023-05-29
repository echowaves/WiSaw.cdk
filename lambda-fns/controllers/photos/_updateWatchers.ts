import psql from "../../psql"

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");
// select distinct "watchersCount" from "Photos" order by "watchersCount" DESC;

export const _updateWatchers = async (photoId: bigint, uuid: string) => {
  await psql.connect()

  const count = (
    await psql.query(`
  UPDATE "Photos"
      SET "watchersCount" =
        (SELECT COUNT(id) as "watchersCount" from "Watchers" where "Watchers"."photoId" = ${photoId}
        AND "Watchers"."uuid" != "Photos"."uuid")
      WHERE id = ${photoId}
      returning *`)
  ).rows[0]
  await psql.clean()

  return count.watchersCount
}
