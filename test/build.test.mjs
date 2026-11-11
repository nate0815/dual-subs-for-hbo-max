import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script } from 'node:vm'
import { buildUserscript, RELEASE_URL, AUTHOR } from '../scripts/build-userscript.mjs'

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'))
const readFile = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const out = buildUserscript(manifest, readFile)

test('build：@version 等於 manifest 的 version（竄改猴靠它判斷更新）', () => {
  assert.match(out, new RegExp(`// @version\\s+${manifest.version.replace(/\./g, '\\.')}\\n`))
})

test('build：檔案依 manifest 的順序串接', () => {
  const pos = manifest.content_scripts[0].js.map((f) => out.indexOf(`// ---- ${f} ----`))
  assert.ok(pos.every((p) => p > 0), '每個檔都要在')
  assert.deepEqual([...pos].sort((a, b) => a - b), pos)
})

test('build：@match、更新網址、主世界都有', () => {
  for (const m of manifest.content_scripts[0].matches) assert.ok(out.includes(`// @match        ${m}`))
  assert.ok(out.includes(`// @updateURL    ${RELEASE_URL}`))
  assert.ok(out.includes('// @grant        none'))
})

test('build：@author 與 package.json、LICENSE 一致', () => {
  assert.ok(out.includes(`// @author       ${AUTHOR}`))
  const pkg = JSON.parse(readFile('package.json'))
  assert.equal(pkg.author, AUTHOR)
  assert.match(readFile('LICENSE'), new RegExp(`Copyright \\(c\\) \\d{4} ${AUTHOR}\\r?\\n`))
})

test('build：產出是語法正確的 JavaScript', () => {
  assert.doesNotThrow(() => new Script(out))
})
