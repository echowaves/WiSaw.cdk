/* eslint-env node */
const oldUtils = require('./lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils')
const fs = require('fs')
const path = require('path')

const BODY_CASES = {
  photoFull: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: '2f3c38f7-9c2d-4c8b-9098-894070265dd7', pageTitle: 'Leaf, Plant, Tree — photo · WiSaw', description: 'Leaf, Plant, Tree unaltered photo. Taken in Canton, Massachusetts.', caption: 'A leaf', labels: ['Leaf', 'Plant', 'Tree'], created: '2026-11-16T13:09:08.523Z', width: '4000', height: '3000' },
  photoBare: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: 'aaaabbbb-cccc-dddd-eeee-ffff00001111' },
  photoNoDims: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: '29461ee8-34dd-4c2b-848f-c16d766713e8', width: '0', height: '', labels: ['xxxxx'] },
  videoFull: { entityLabel: 'video', pathSegment: 'videos', imageIdText: '2f3c38f7-9c2d-4c8b-9098-894070265dd7', pageTitle: 'Sunset — video, Provincetown, Oct 2026 · WiSaw', description: 'Sunset over the harbour.', labels: ['Sunset'], videoUrl: 'https://img.wisaw.com/2f3c38f7-9c2d-4c8b-9098-894070265dd7.mov', created: '2026-10-01T00:00:00.000Z', duration: 42, width: '1080', height: '1920' },
  videoNoDuration: { entityLabel: 'video', pathSegment: 'videos', imageIdText: '00000000-1111-2222-3333-444444444444', videoUrl: 'https://img.wisaw.com/00000000-1111-2222-3333-444444444444.mp4', width: '720', height: '1280' },
  xssLabels: { entityLabel: 'photo', pathSegment: 'photos', imageIdText: '<script>x</script>', labels: ['<img onerror=alert(1)>', 'ok'], caption: '</p><h1>hi</h1>', description: 'a "quoted" & <escaped> one' }
}

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests', 'fixtures', 'edge-detail-bodies.json'), 'utf8'))

// The only intentional byte change is dropping the '#root ' ancestor prefix inside the <style> block.
for (const [name, options] of Object.entries(BODY_CASES)) {
  const oldBody = oldUtils.buildSeoBody(options)
  const newBody = fixtures[name]
  const normalizedOld = oldBody.replace(/#root \.wsk/g, '.wsk')
  if (normalizedOld === newBody) {
    console.log(name, 'IDENTICAL modulo #root scoping')
  } else {
    console.log(name, 'DIFFERS')
    let i = 0
    while (i < Math.max(normalizedOld.length, newBody.length) && normalizedOld[i] === newBody[i]) i++
    console.log('first diff at', i)
    console.log('old:', JSON.stringify(normalizedOld.slice(Math.max(0, i - 60), i + 90)))
    console.log('new:', JSON.stringify(newBody.slice(Math.max(0, i - 60), i + 90)))
  }
}
