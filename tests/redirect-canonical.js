/* eslint-env node */
const { expect } = require('chai')
const { describe, it } = require('mocha')

const { handler } = require('../lambda-fns/lambdas/redirectLambdaEdgeFunction/index')

const buildEvent = (uri, opts = {}) => ({
  Records: [{
    cf: {
      request: {
        uri,
        querystring: opts.querystring ?? '',
        headers: {
          host: [{ key: 'Host', value: opts.host ?? 'wisaw.com' }]
        }
      }
    }
  }]
})

const locationOf = (result) =>
  result?.headers?.location?.[0]?.value

describe('redirectLambdaEdgeFunction', () => {
  it('leaves a legacy id containing zeros untouched', async () => {
    // …029801 used to lose its internal zero and 301 to …002981, an unrelated photo.
    const uri = '/photos/00000000-0000-0000-0000-000000029801'
    const result = await handler(buildEvent(uri))
    expect(locationOf(result)).to.equal(undefined)
    expect(result.uri).to.equal(uri)
  })

  it('leaves every legacy id untouched, however many zeros it holds', async () => {
    const ids = [
      '00000000-0000-0000-0000-000000015260',
      '00000000-0000-0000-0000-000000010458',
      '00000000-0000-0000-0000-000000020506'
    ]
    for (const id of ids) {
      const result = await handler(buildEvent(`/photos/${id}`))
      expect(locationOf(result), id).to.equal(undefined)
    }
  })

  it('leaves a modern uuid containing zeros untouched', async () => {
    const uri = '/photos/43a81e8e-58d4-4704-b4b9-48e507ef7d6c'
    const result = await handler(buildEvent(uri))
    expect(locationOf(result)).to.equal(undefined)
  })

  it('redirects a bare integer id to its padded uuid', async () => {
    const result = await handler(buildEvent('/photos/15260'))
    expect(result.status).to.equal('301')
    expect(locationOf(result)).to.equal('https://wisaw.com/photos/00000000-0000-0000-0000-000000015260')
  })

  it('redirects a bare integer video id to its padded uuid', async () => {
    const result = await handler(buildEvent('/videos/42'))
    expect(locationOf(result)).to.equal('https://wisaw.com/videos/00000000-0000-0000-0000-000000000042')
  })

  it('lower-cases an upper-case uuid so one photo keeps one url', async () => {
    const result = await handler(buildEvent('/photos/43A81E8E-58D4-4704-B4B9-48E507EF7D6C'))
    expect(locationOf(result)).to.equal('https://wisaw.com/photos/43a81e8e-58d4-4704-b4b9-48e507ef7d6c')
  })

  it('drops a trailing slash', async () => {
    const result = await handler(buildEvent('/photos/43a81e8e-58d4-4704-b4b9-48e507ef7d6c/'))
    expect(locationOf(result)).to.equal('https://wisaw.com/photos/43a81e8e-58d4-4704-b4b9-48e507ef7d6c')
  })

  it('keeps the query string when canonicalising', async () => {
    const result = await handler(buildEvent('/photos/15260', { querystring: 'utm_source=news' }))
    expect(locationOf(result)).to.equal('https://wisaw.com/photos/00000000-0000-0000-0000-000000015260?utm_source=news')
  })

  it('moves www to the apex for ordinary pages', async () => {
    const result = await handler(buildEvent('/about', { host: 'www.wisaw.com' }))
    expect(locationOf(result)).to.equal('https://wisaw.com/about')
  })

  it('does not redirect an already canonical apex url', async () => {
    const result = await handler(buildEvent('/'))
    expect(locationOf(result)).to.equal(undefined)
  })
})
