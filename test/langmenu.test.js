const test = require('node:test')
const assert = require('node:assert/strict')
const { langName, trackLabel } = require('../src/lib/langmenu.js')

test('langName：語言代碼轉繁中名稱', () => {
  assert.equal(langName('en-US'), '英文（美國）')
  assert.equal(langName('ja'), '日文')
})

test('langName：代碼不合法時退回代碼本身，空字串給「未知語言」，不拋錯', () => {
  assert.equal(langName('not a tag!'), 'not a tag!')
  assert.equal(langName(''), '未知語言')
})

test('trackLabel：caption 角色加 CC，其餘只有語言名稱', () => {
  assert.equal(trackLabel({ lang: 'en-US', role: 'caption' }), '英文（美國） CC')
  assert.equal(trackLabel({ lang: 'ja', role: 'subtitle' }), '日文')
  assert.equal(trackLabel({ lang: 'ja', role: null }), '日文')
})
