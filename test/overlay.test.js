const test = require('node:test')
const assert = require('node:assert/strict')
const { bottomPad } = require('../src/lib/overlay.js')

// 影片 1000px 高、下緣在畫面 y=1000
const RECT = { bottom: 1000, height: 1000 }

test('bottomPad：偵測不到控制列 → 固定 9%', () => {
  assert.equal(Math.round(bottomPad(RECT, null)), 90)
})

test('bottomPad：控制列收起 → 4%', () => {
  assert.equal(Math.round(bottomPad(RECT, { top: 0, visible: false })), 40)
})

test('bottomPad：控制列出現 → 讓到控制列上緣再往上 1.5%', () => {
  // 控制列上緣在 y=850：離下緣 150，再加 15
  assert.equal(Math.round(bottomPad(RECT, { top: 850, visible: true })), 165)
})

test('bottomPad：控制列很矮時不低於收起時的 4%', () => {
  assert.equal(Math.round(bottomPad(RECT, { top: 990, visible: true })), 40)
})
