/* eslint-env node */
/* global require, exports, process */
const { sanitizeImageId, injectMetaTags, buildSeoBody, htmlResponse, renderNotFoundDocument } = require('./utils')
const { parseMediaUri } = require('./mediaUri')
const { fetchShell } = require('./template')
const { fetchSidecar } = require('./sidecar')
const { buildSeoFields } = require('./seoText')
const { probeMedia, readDuration } = require('./media')

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

  const s3Duration = await readDuration(IMG_BUCKET, media.key)

  const seo = buildSeoFields({
    sidecar,
    entityLabel: 'video',
    imageIdText,
    lastModified: media.lastModified
  })

  const description = seo.metaDescription || FALLBACK_DESCRIPTION
  // Point players and crawlers at the object that actually exists rather than assuming a
  // .mov key: og:video and VideoObject.contentUrl used to 403 for every video not stored
  // under <id>.mov, which makes the rich result invalid.
  const mediaKey = /\.(mov|mp4|webm|m4v)$/i.test(media.key) ? media.key : `${imageIdRaw}.mov`
  const videoUrl = `https://img.wisaw.com/${mediaKey}`
  const created = seo.created || media.lastModified
  const duration = seo.duration || s3Duration
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
    ogType: 'video',
    pathSegment: 'videos',
    imageIdText,
    imageIdUrl,
    pageTitle: seo.pageTitle,
    imageTitle: seo.imageTitle,
    imageCaption: seo.imageCaption,
    created,
    duration,
    videoUrl,
    width: seo.width,
    height: seo.height,
    bodyHtml: seoBody
  })

  return callback(null, htmlResponse(200, body))
}
