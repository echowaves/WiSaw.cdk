/* eslint-env node */
/* global module */

// The static detail page Lambda@Edge paints into the #root mount point.
//
// This is not a placeholder any more: it is the page a browser paints before a single byte of
// JavaScript has run, and the client (WiSaw.client src/utils/detailSkeleton.js) adopts these exact
// nodes instead of replacing them. That adoption is what removes the LCP/CLS failure this replaces
// - React used to unmount the painted media at hydration, which re-dated the LCP paint to JS
// delivery time and shifted the layout under the user.
//
// Adoption is strict, so these attributes are a wire contract shared with the client repo and
// pinned by tests on both sides: [data-wisaw-media] carries data-wisaw-id equal to the route id
// (lower case) plus numeric width/height; both slot divs must exist; and the media node's parent
// must be a positioned box, never the mount point itself - the interactive overlays portal into
// that box, so it needs position: relative.
//
// Geometry mirrors the client rather than inventing numbers (src/utils/detailLayout.js,
// src/containers/Header.css): 700 px long side above the 700 px breakpoint, viewport-40 below it,
// a 72 px header band (64 px at <=768px) and 220 px reserved under the fold. The edge cannot know
// the viewport, so the two widths live in CSS and only the orientation-dependent cap is inline.

const DETAIL_MAX_SIDE = 700
const DETAIL_MOBILE_BREAKPOINT = 700
const HEADER_DESKTOP_PX = 72
const HEADER_MOBILE_PX = 64
const BELOW_MEDIA_RESERVE_PX = 220
const MEDIA_RADIUS_PX = 18

// Scoped to #root with unique class names: the deployed app's stylesheet is already linked when
// this markup paints, so nothing here may rely on - or collide with - a class the app owns.
// Descendant selectors only, no child combinators, and no `<` or `>` characters: this block lives
// inside the crawler body the mount-point scanner walks.
const SKELETON_STYLE = '<style>' +
  '#root .wsk{display:block}' +
  '#root .wsk-main{max-width:1100px;margin:0 auto;padding:20px 20px 28px}' +
  '#root .wsk-slot-header{min-height:' + HEADER_DESKTOP_PX + 'px}' +
  '#root .wsk-slot-below{min-height:' + BELOW_MEDIA_RESERVE_PX + 'px}' +
  '#root .wsk-box{position:relative;margin:16px auto;width:calc(100vw - 40px);max-width:100%;' +
  'overflow:hidden;border-radius:' + MEDIA_RADIUS_PX + 'px;background:var(--bg-raised,#f4f4f5)}' +
  '#root .wsk-media{display:block;width:100%;height:100%;object-fit:contain;' +
  'border-radius:' + MEDIA_RADIUS_PX + 'px}' +
  '#root .wsk-box--broken .wsk-media{visibility:hidden}' +
  '@media screen and (min-width:' + DETAIL_MOBILE_BREAKPOINT + 'px){' +
  '#root .wsk-box{width:var(--wsk-cap,' + DETAIL_MAX_SIDE + 'px)}}' +
  '@media screen and (max-width:768px){#root .wsk-slot-header{min-height:' + HEADER_MOBILE_PX + 'px}}' +
  '</style>'

// Hides the media box's picture when the object is gone, leaving the reserved geometry in place:
// a failed fetch must not shift the page. Script-local, never throws, no dependency on the bundle.
const MEDIA_ONERROR = "this.parentNode&amp;&amp;(this.parentNode.className+=' wsk-box--broken')"

function positiveInt (value) {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Inline geometry for the media box. When the record has no usable dimensions the box falls back
 * to a neutral square at the full desktop cap instead of an auto height, which is what shifts.
 */
function mediaBoxStyle (width, height) {
  const w = positiveInt(width)
  const h = positiveInt(height)
  if (w === null || h === null) return 'aspect-ratio:1/1;--wsk-cap:' + DETAIL_MAX_SIDE + 'px'
  // The client caps the long side at 700 px, so a portrait media element is displayed narrower.
  const cap = w > h ? DETAIL_MAX_SIDE : Math.round(DETAIL_MAX_SIDE * w / h)
  return 'aspect-ratio:' + w + '/' + h + ';--wsk-cap:' + cap + 'px'
}

/** The enhancement slots React portals into: header band above, comments/footer below. */
function slot (name) {
  return '<div class="wsk-slot-' + name + '" data-wisaw-slot="' + name + '"></div>'
}

/**
 * Wraps the already-escaped media element in its fixed box and lays out the page around it.
 * `mediaHtml` arrives escaped by utils.js - this module never receives raw record text.
 */
function renderSkeleton (parts = {}) {
  const { route = 'photos', mediaHtml = '', boxStyle = '', title = '', descriptionHtml = '', labelLinksHtml = '', navHtml = '' } = parts
  return '<div class="wsk" data-wisaw-route="' + route + '">' +
    slot('header') +
    '<div class="wsk-main">' +
    '<div class="wsk-box" style="' + boxStyle + '">' + mediaHtml + '</div>' +
    '<h1>' + title + '</h1>' +
    descriptionHtml +
    labelLinksHtml +
    navHtml +
    slot('below') +
    '</div>' +
    '</div>'
}

/** Breadcrumb graph for a detail page. The client stops publishing head data, so the edge owns it. */
function breadcrumbGraph (parts = {}) {
  const { title = '', pageUrl = '' } = parts
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://wisaw.com/' },
      { '@type': 'ListItem', position: 2, name: title, item: pageUrl }
    ]
  }
}

module.exports = {
  DETAIL_MAX_SIDE,
  DETAIL_MOBILE_BREAKPOINT,
  BELOW_MEDIA_RESERVE_PX,
  HEADER_DESKTOP_PX,
  HEADER_MOBILE_PX,
  SKELETON_STYLE,
  MEDIA_ONERROR,
  mediaBoxStyle,
  renderSkeleton,
  breadcrumbGraph
}
