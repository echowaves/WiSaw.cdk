#!/usr/bin/env node
/* eslint-env node */
/* global require, module, __dirname, process, console, __dirname */

// Publishes the detail page template from this repository into the browser app.
//
// lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js is what Lambda@Edge paints into the
// #root mount point for /photos/<id> and /videos/<id>. The app used to answer every detail render
// the edge did not paint — prev/next navigation, local development, a stale edge cache — with its
// own older template, so one page had two looks and any layout change had to be made twice. This
// script renders that one module into a committed ES module inside WiSaw.client, which paints the
// same markup from a string and portals its enhancements into the same slots.
//
//     node scripts/publish-detail-template.js
//
// The transform is deliberately mechanical: the body of the source file is emitted verbatim (only
// the Node-only pragma comments are dropped) and the export list is regenerated from the module's
// own keys, so there is no second copy of any rule. tests/detail-template-copy-once.js fails when
// the committed file no longer matches this file — byte for byte, and function by function — so a
// forgotten run cannot ship an app that renders a different page than the edge does.

const fs = require('fs')
const path = require('path')

const SOURCE = path.resolve(__dirname, '..', 'lambda-fns', 'lambdas', 'injectMetaTagsLambdaFunction', 'skeleton.js')
const TARGET = path.resolve(__dirname, '..', '..', 'WiSaw.client', 'src', 'utils', 'detailTemplate.generated.js')

const skeleton = require(SOURCE)

/** The Node pragmas an ES module in the app must not carry. */
function stripNodePragmas (text) {
  return text
    .split('\n')
    .filter((line) => !/^\/\*\s*eslint-env node\s*\*\/$/.test(line) && !/^\/\*\s*global[^\n]*\*\/$/.test(line))
    .join('\n')
}

/** The source body with its CommonJS export block removed; the named exports are appended after. */
function cutCommonJsExports (text) {
  const cut = text.lastIndexOf('\nmodule.exports = {')
  if (cut === -1) {
    throw new Error('skeleton.js no longer ends in a module.exports block — the publish script must be updated')
  }
  return text.slice(0, cut).trimEnd() + '\n'
}

function renderDetailTemplateModule () {
  const names = Object.keys(skeleton)
  if (names.length === 0) throw new Error('skeleton.js exports nothing')

  const header = [
    '/* eslint-disable */',
    '// GENERATED — do not edit. Written by WiSaw.cdk/scripts/publish-detail-template.js from',
    '// lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js, the file Lambda@Edge paints the',
    '// detail page from. Edit that file and run the script; a stale copy is caught by',
    '// WiSaw.cdk/tests/detail-template-copy-once.js.',
    '',
    '// The detail page frame: markup, geometry and the media element, shared with the edge so a',
    '// deep link and a prev/next navigation cannot render two different pages. Nothing here is',
    "// app-owned; src/utils/detailSkeleton.js is what paints it and hands its slots to React."
  ].join('\n')

  const body = cutCommonJsExports(stripNodePragmas(fs.readFileSync(SOURCE, 'utf8')))

  // A plain named-export list of the bindings already in scope: nothing is re-declared, so the
  // emitted body stays verbatim and the drift test can evaluate this same text as CommonJS.
  const exportsBlock = 'export {\n' +
    names.map((name) => '  ' + name + ',').join('\n') +
    '\n}\n'

  return header + '\n\n' + body + '\n' + exportsBlock
}

function main () {
  const text = renderDetailTemplateModule()
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

module.exports = { renderDetailTemplateModule, TARGET, SOURCE }
