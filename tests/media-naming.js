/* eslint-env node */
// The naming rule is shared by three surfaces — the edge injector (plain CommonJS), the sitemap
// generator and the API model (both esbuild-bundled TypeScript) — so it is pinned here once,
// rather than through each consumer. Ticket 5: one rule must answer for all of them.
const { expect } = require('chai')
const { describe, it } = require('mocha')

const naming = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaNaming')
const {
  VIDEO_EXTENSIONS,
  isVideoObjectKey,
  isImageObjectKey,
  isThumbnailObjectKey,
  videoObjectKey,
  pickVideoObjectKey,
  imageObjectKey,
  thumbnailObjectKey,
  imgUrl
} = naming

const ID = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'

describe('mediaNaming - one rule for what a media object is called', () => {
  it('recognises every video extension the surface can serve', () => {
    for (const ext of VIDEO_EXTENSIONS) {
      expect(isVideoObjectKey(`${ID}.${ext}`), ext).to.equal(true)
    }
    expect(isVideoObjectKey(`${ID}.MOV`), 'uppercase spelling').to.equal(true)
    expect(isVideoObjectKey(`${ID}.webp`)).to.equal(false)
    expect(isVideoObjectKey(`${ID}-thumb.webp`)).to.equal(false)
    expect(isVideoObjectKey(`${ID}.json`)).to.equal(false)
    expect(isVideoObjectKey('')).to.equal(false)
  })

  it('separates the full image from its thumbnail', () => {
    expect(isImageObjectKey(imageObjectKey(ID))).to.equal(true)
    expect(isImageObjectKey(thumbnailObjectKey(ID))).to.equal(false)
    expect(isThumbnailObjectKey(thumbnailObjectKey(ID))).to.equal(true)
  })

  it('uses a key the caller resolved from storage', () => {
    expect(videoObjectKey(ID, `${ID}.mp4`)).to.equal(`${ID}.mp4`)
  })

  it('falls back to the documented extension instead of returning nothing', () => {
    // A probe that could not reach storage, or a listing that came back empty: the caller still
    // has to publish a well-formed URL.
    expect(videoObjectKey(ID)).to.equal(`${ID}.${VIDEO_EXTENSIONS[0]}`)
    expect(videoObjectKey(ID, '')).to.equal(`${ID}.${VIDEO_EXTENSIONS[0]}`)
    // A non-video key is not evidence of the video's name.
    expect(videoObjectKey(ID, `${ID}-thumb.webp`)).to.equal(`${ID}.${VIDEO_EXTENSIONS[0]}`)
  })

  it('picks deterministically when several objects share one id', () => {
    // S3 returns keys in lexicographic order, so an unsorted `find` would answer .m4v for the
    // same media that the head calls .mov. The declared order decides instead — both surfaces.
    const stored = [`${ID}.m4v`, `${ID}.mp4`, `${ID}.webm`, `${ID}.mov`]
    expect(pickVideoObjectKey(ID, stored)).to.equal(`${ID}.${VIDEO_EXTENSIONS[0]}`)
    expect(pickVideoObjectKey(ID, [...stored].reverse())).to.equal(`${ID}.${VIDEO_EXTENSIONS[0]}`)
    expect(pickVideoObjectKey(ID, [`${ID}.mp4`, `${ID}.webm`])).to.equal(`${ID}.mp4`)
  })

  it('falls back to whatever video object exists, then to the naming rule', () => {
    expect(pickVideoObjectKey(ID, [`${ID}.avi`])).to.equal(`${ID}.avi`)
    expect(pickVideoObjectKey(ID, [])).to.equal(`${ID}.${VIDEO_EXTENSIONS[0]}`)
  })

  it('builds absolute URLs without doubling a slash', () => {
    expect(imgUrl(imageObjectKey(ID))).to.equal(`https://img.wisaw.com/${ID}.webp`)
    expect(imgUrl(`/${ID}`), 'leading slash').to.equal(`https://img.wisaw.com/${ID}`)
    expect(imgUrl(thumbnailObjectKey(ID))).to.equal(`https://img.wisaw.com/${ID}-thumb.webp`)
  })

  it('keeps the spellings the surfaces published before this module existed', () => {
    // Regression guard: the sitemap, the injector and the model all hardcoded these strings.
    expect(imageObjectKey(ID)).to.equal(`${ID}.webp`)
    expect(thumbnailObjectKey(ID)).to.equal(`${ID}-thumb.webp`)
    expect(videoObjectKey(ID)).to.equal(`${ID}.mov`)
  })
})
