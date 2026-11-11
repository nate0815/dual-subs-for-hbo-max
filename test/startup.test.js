// 啟動煙霧測試：照 manifest 的順序，在模擬的瀏覽器環境裡實際執行全部內容腳本。
// 抓的是 TECH「不變式」第 1 條那種錯 —— 順序或匯出名稱不對時，main.js 解構到 undefined，
// 在真的瀏覽器裡是「靜默沒字幕」，這裡會直接失敗。
// 不驗證畫面（那要實機），只驗證「能啟動、介面都在、計時器與觀察器有掛上」。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.join(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
const files = manifest.content_scripts[0].js

function fakeBrowser() {
  const calls = { observe: 0, interval: 0, listeners: [] }
  const store = new Map()
  const win = {
    console: { info() {}, warn() {}, log() {} },
    URL,
    Intl,
    Date,
    Math,
    JSON,
    Map,
    Promise,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    PerformanceObserver: class {
      observe() {
        calls.observe++
      }
    },
    setInterval: () => (calls.interval++, 1),
    setTimeout: () => 1,
    clearTimeout() {},
    addEventListener: (type) => calls.listeners.push(type),
    location: { pathname: '/' },
    document: { body: null, querySelector: () => null },
    fetch: async () => ({ ok: false, status: 0 }),
  }
  win.window = win
  win.globalThis = win
  return { win, calls }
}

test('startup：照 manifest 順序執行全部內容腳本，不拋例外', () => {
  const { win, calls } = fakeBrowser()
  const ctx = vm.createContext(win)
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f })
  }
  const hds = win.__HDS__
  assert.ok(hds, '__HDS__ 要存在')
  for (const name of ['parseVtt', 'activeAt', 'parseTextTracks', 'resolveTrack', 'createOverlay', 'createLangMenu', 'findControls', 'drawerOpen', 'formatOffset', 'bottomPad']) {
    assert.equal(typeof hds[name], 'function', `__HDS__.${name} 要是函式`)
  }
  assert.ok(hds.state, 'main.js 要掛上 __HDS__.state（代表它跑完了）')
  assert.equal(calls.observe, 1, '要開始觀察資源請求（找 .mpd）')
  assert.equal(calls.interval, 1, '要啟動 tick 計時器')
  assert.ok(calls.listeners.includes('keydown'), '要監聽快捷鍵')
})

test('startup：順序錯了會失敗（確認這個測試真的抓得到）', () => {
  const { win } = fakeBrowser()
  const ctx = vm.createContext(win)
  const wrong = [...files.filter((f) => f.endsWith('main.js')), ...files.filter((f) => !f.endsWith('main.js'))]
  assert.throws(() => {
    for (const f of wrong) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f })
  })
})
