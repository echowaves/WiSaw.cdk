/* eslint-env node */
/* global require, exports, process */
const { sanitizeImageId, injectMetaTags, buildSeoBody, htmlResponse, renderNotFoundDocument } = require('./utils')
const { parseMediaUri } = require('./mediaUri')
const { fetchShell } = require('./template')
const { fetchSidecar } = require('./sidecar')
const { buildSeoFields } = require('./seoText')
const { durationSeconds } = require('./seoRules')
const { probeMedia, readDuration } = require('./media')
const { videoObjectKey, imgUrl } = require('./mediaNaming')

const IMG_BUCKET = process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'
const FALLBACK_DESCRIPTION = 'Free unaltered video on WiSaw - authentic photos and videos taken with phone cameras.'

exports.handler = async (event, context, callback) => {
  const { request } = event.Records[0].cf
  const parsed = parseMediaUri(request.uri)

  if (!parsed.valid) {
    return callback(null, htmlResponse(404, renderNotFoundDocument('video'), { noindex: true, cacheControl: 'max-age=86400' }))
  }

  const { text: imageIdText, url: imageIdUrl, raw: imageIdRaw } = sanitizeImageId(`/${parsed.kind}/${parsed.id}`)

  const [sidecar, media] = await Promise.all([
    fetchSidecar(imageIdRaw),
    probeMedia(IMG_BUCKET, imageIdRaw)
  ])

  // See the note in photo.js: a definitive miss only. Videos are matched by id prefix so an
  // object stored as .mp4 instead of .mov is never mistaken for a deleted page.
  if (!media.exists) {
    return callback(null, htmlResponse(404, renderNotFoundDocument('video'), { noindex: true, cacheControl: 'max-age=86400' }))
  }

  const seo = buildSeoFields({
    sidecar,
    entityLabel: 'video',
    imageIdText,
    lastModified: media.lastModified
  })

  // The record carries the length that was read out of this object's own container when the record
  // was written. Only a video whose record predates that field still asks the object, and even then
  // it reads metadata rather than parsing bytes - on a crawler request that stays one cheap HEAD.
  const duration = seo.duration ?? durationSeconds(await readDuration(IMG_BUCKET, media.key))

  const description = seo.metaDescription || FALLBACK_DESCRIPTION
  // Point players and crawlers at the object that actually exists rather than assuming a
  // .mov key: og:video and VideoObject.contentUrl used to 403 for every video not stored
  // under <id>.mov, which makes the rich result invalid.
  const mediaKey = videoObjectKey(imageIdRaw, media.key)
  const videoUrl = imgUrl(mediaKey)
  const created = seo.created || media.lastModified
  const index = await fetchShell()

  const seoBody = buildSeoBody({
    entityLabel: 'video',
    pathSegment: 'videos',
    imageIdText,
    pageTitle: seo.pageTitle,
    description,
    caption: seo.caption,
    labels: seo.labels,
    videoUrl,
    created,
    duration,
    width: seo.width,
    height: seo.height
  })

  const body = injectMetaTags(index, {
    description,
    metaDescription: description,
    entityLabel: 'video',
    // 'video' alone is not a registered Open Graph type, and the browser app already
    // publishes video.other - one pair for both sides.
    ogType: 'video.other',

    pathSegment: 'videos',
    imageIdText,
    imageIdUrl,
    pageTitle: seo.pageTitle,
    imageTitle: seo.imageTitle,
    imageCaption: seo.imageCaption,
    created,
    videoDuration: duration,
    videoUrl,
    width: seo.width,
    height: seo.height,
    bodyHtml: seoBody
  })

  return callback(null, htmlResponse(200, body))
}
