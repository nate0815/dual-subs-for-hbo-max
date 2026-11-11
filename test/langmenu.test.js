const test = require('node:test')
const assert = require('node:assert/strict')
const { langName, trackLabel, formatOffset } = require('../src/lib/langmenu.js')

test('langName：語言代碼轉繁中名稱', () => {
  assert.equal(langName('en-US'), '英文（美國）')
  assert.equal(langName('ja'), '日文')
})

test('langName：多餘的文字標記不重複顯示（HBO 日文軌是 ja-Jpan），地區保留', () => {
  assert.equal(langName('ja-Jpan'), '日文')
  assert.equal(langName('ja-Jpan-JP'), langName('ja-JP'))
})

test('langName：中文的繁體／簡體一律保留；非預設文字也保留', () => {
  assert.equal(langName('zh-Hant-TW'), '中文（繁體，台灣）')
  assert.match(langName('zh-Hans-SG'), /簡體/)
  assert.match(langName('zh-Hant'), /繁體/)
  // 塞爾維亞文預設是西里爾字母，拉丁字母版要分得出來
  assert.notEqual(langName('sr-Latn'), langName('sr'))
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

test('formatOffset：正值＝提早、負值＝延後、0＝不偏移', () => {
  assert.equal(formatOffset(200), '字幕提早 0.2 秒')
  assert.equal(formatOffset(-1500), '字幕延後 1.5 秒')
  assert.equal(formatOffset(0), '字幕時間：不偏移')
})
