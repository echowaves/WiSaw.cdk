import uuid from 'uuid'

import supertest from 'supertest'
import chai from 'chai'

import {config,} from '../.env.test'

const request = supertest(config().HOST)
const {expect,} = chai // BDD/TDD assertion library

describe('abusereport', () => {
  it('should not be able to post an abuseReport with no parameters', async () => {
    const response =
    await request
      .post('/abusereport')
      .set('Content-Type', 'application/json')

    expect(response.status).to.equal(400)
    expect(response.body.error).to.equal('parameters missing')
  })

  it('should be able to post an abusereport with right parameters', async () => {
    const guid = uuid()

    const response =
    await request
    	.post('/abusereport')
    	.set('Content-Type', 'application/json')
    	.send({uuid: guid,})

    expect(response.status).to.equal(201)
    expect(response.body.status).to.equal('success')
  })


  it('should not be able to post a photo wben too many abuses reported', async () => {
    const guid = uuid()

    const point = {type: 'Point', coordinates: [-29.396377, -137.585190,],}
    // console.log("contents.size: ", contents.length)
    // post 4 abuse reports for a particular UUID
    await request
      .post('/abusereport')
      .set('Content-Type', 'application/json')
      .send({uuid: guid,})
    await request
      .post('/abusereport')
      .set('Content-Type', 'application/json')
      .send({uuid: guid,})
    await request
      .post('/abusereport')
      .set('Content-Type', 'application/json')
      .send({uuid: guid,})
    await request
      .post('/abusereport')
      .set('Content-Type', 'application/json')
      .send({uuid: guid,})

    const response =
    await request
    	.post('/photos')
    	.set('Content-Type', 'application/json')
    	.send({uuid: guid,})
    	.send({location: point,})

    expect(response.status).to.equal(401)
    expect(response.body.error).to.equal('Anauthorized.')
  })
})
