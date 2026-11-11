#!/usr/bin/env node
/* eslint-env node */
/* global require, module, __dirname, process, console */

// Publishes the static-route SEO copy from this repository into the browser app.
//
// The route table in lambda-fns/lambdas/injectMetaTagsLambdaFunction/static.js is what a crawler
// that does not run JavaScript is served. The app used to write its own wording for the same four
// URLs, so whichever side was edited last won for whoever was looking. This script renders that
// table into a committed ES module inside WiSaw.client, which keeps `npm run build` independent of
// this checkout while leaving exactly one place where the copy is authored.
//
//     node scripts/publish-static-seo.js
//
// tests/static-route-copy-once.js fails when the committed file no longer matches the table, so a
// forgotten run cannot slip into a deploy.

const fs = require('fs')
const path = require('path')

const { ROUTES } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/static')
const { SITE_NAME, LOCALE, ROBOTS_INDEX, ROBOTS_NOINDEX, TWITTER_CARD } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')

const TARGET = path.resolve(__dirname, '..', '..', 'WiSaw.client', 'src', 'utils', 'staticSeo.generated.js')

// The helper the app calls, kept as source text and emitted verbatim so the substitution rule
// exists once. Not a real function in this script on purpose: the test runner loads this file
// through Babel, which rewrites `fn.toString()` — a generated file that never matches its own
// generator is worse than no generator. `STATIC_ROUTES` is in scope where these lines land.
const HEAD_FN_SOURCE = [
  "export function staticHead (pathname = '', term = '') {",
  "  const clean = String(pathname || '').replace(/[?#].*$/, '').replace(/\\/+$/, '') || '/'",
  "  const key = STATIC_ROUTES[clean] ? clean : `/${clean.split('/')[1] || ''}`",
  '  const route = STATIC_ROUTES[key]',
  '  if (!route) return null',
  '',
  "  if (String(term || '') !== '' && route.canonicalTerm) {",
  '    const fill = (template) => String(template).replace(/\\{term\\}/g, term)',
  '    return {',
  '      title: fill(route.titleTerm),',
  '      description: fill(route.descriptionTerm),',
  "      canonical: String(route.canonicalTerm).replace('{term}', encodeURIComponent(term)),",
  '      image: route.image,',
  '      noindex: route.noindex',
  '    }',
  '  }',
  '',
  '  return {',
  '    title: route.title,',
  '    description: route.description,',
  '    canonical: route.canonical,',
  '    image: route.image,',
  '    noindex: route.noindex',
  '  }',
  '}'
].join('\n')

function renderStaticSeoModule () {
  const header = [
    '/* eslint-disable */\n// GENERATED — do not edit. Written by WiSaw.cdk/scripts/publish-static-seo.js from',
    '// lambda-fns/lambdas/injectMetaTagsLambdaFunction/static.js and utils.js, the files the',
    '// Lambda@Edge injector serves. Edit the route table there and run the script; a stale copy is',
    '// caught by WiSaw.cdk/tests/static-route-copy-once.js.',
    '',
    '// Head values every page shares with the edge: one line each, no second copy to drift.'
  ].join('\n')

  const shared = [
    `export const SITE_NAME = ${JSON.stringify(SITE_NAME)}`,
    `export const LOCALE = ${JSON.stringify(LOCALE)}`,
    `export const ROBOTS_INDEX = ${JSON.stringify(ROBOTS_INDEX)}`,
    `export const ROBOTS_NOINDEX = ${JSON.stringify(ROBOTS_NOINDEX)}`,
    `export const TWITTER_CARD = ${JSON.stringify(TWITTER_CARD)}`
  ].join('\n')

  const routes = [
    '// The static routes, exactly as the edge serves them: title, description, canonical, share',
    '// image and whether the page is excluded from the index.',
    `export const STATIC_ROUTES = ${JSON.stringify(ROUTES, null, 2)}`
  ].join('\n')

  return `${header}\n\n${shared}\n\n${routes}\n\n/**\n * Head values for one app pathname, with \`{term}\` filled in for search results. Returns null for a\n * path the edge does not own, so a caller never invents copy for an unknown route.\n */\n${HEAD_FN_SOURCE}\n`
}

function main () {
  const text = renderStaticSeoModule()
  if (!fs.existsSync(path.dirname(TARGET))) {
    console.error(`No WiSaw.client checkout at ${path.dirname(TARGET)} — commit this file from the app repository.`)
    process.exitCode = 1
    return
  }
  const previous = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : null
  fs.writeFileSync(TARGET, text)
  console.log(`${previous === text ? 'unchanged' : 'wrote'} ${TARGET}`)
}

if (require.main === module) {
  main()
}

module.exports = { renderStaticSeoModule, TARGET, HEAD_FN_SOURCE }
