import * as moment from 'moment'

import psql from '../../psql'

import {_updateCommentsCount,} from './_updateCommentsCount'
import {_updateLastComment,} from './_updateLastComment'

import {_notifyAllWatchers,} from '../photos/_notifyAllWatchers'
import watch from '../photos/watch'

export default async function main(photoId: bigint, uuid: string, description: string) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  if(description.trim().length === 0) {
    throw('Unable to save empty comment.')
  }
  await psql.connect()
  const comment =
  (await psql.query(`
    INSERT INTO "Comments"
      (
          "photoId",
          "uuid",
          "comment",
          "createdAt",
          "updatedAt"
      ) values (
        ${photoId},
        '${uuid}',
        '${description}',
        '${createdAt}',
        '${createdAt}'
      )
      returning *
      `
  )
  ).rows[0]
  await psql.clean()

  // console.log({comment})
  await Promise.all([
    watch(photoId, uuid),
    _updateCommentsCount(photoId),
    _notifyAllWatchers(photoId),
    _updateLastComment(photoId),
  ])

  return comment
}
