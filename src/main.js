/* 進入點：發現清單檔 → 取兩條字幕 → 依影片時間畫在疊加層上。
 *
 * 在 manifest 裡以 world:"MAIN" 注入（跟網頁同一個 JS 環境），
 * 載入順序固定為 vtt → mpd → overlay → main，所以這裡一開頭就能從 __HDS__ 解構。
 */
;(function () {
  'use strict'

  const { parseVtt, activeAt, isMpdUrl, parseTextTracks, pickTrack, createOverlay } = window.__HDS__

  const TAG = '[HDS]'
  const KEY = 'hds:settings'
  const TICK_MS = 100

  const DEFAULTS = {
    enabled: true,
    top: ['en'], //              上排：英文（實測的軌是 en-US，role=caption，即「英文 CC」）
    bottom: ['zh-hant', 'zh'], // 下排：繁中，找不到再退到任何中文
    fontScale: 1,
    offsetMs: 0, //              正值＝字幕提早出現
  }

  function loadSettings() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    } catch {
      return { ...DEFAULTS }
    }
  }

  const state = {
    settings: loadSettings(),
    mpdUrl: null,
    ticket: 0, //     換集時用來丟掉舊的非同步結果
    tracks: [],
    top: [],
    bottom: [],
    overlay: null,
  }

  function saveSettings() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.settings))
    } catch {
      /* 儲存失敗不該影響顯示 */
    }
  }

  async function fetchCues(track) {
    if (!track) return []
    if (track.segments > 1) {
      console.warn(TAG, '這條字幕軌有多個分段，v0.1 只讀第一段：', track.lang)
    }
    try {
      const res = await fetch(track.url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return parseVtt(await res.text())
    } catch (err) {
      console.warn(TAG, '抓字幕失敗：', track.lang, err)
      return []
    }
  }

  async function load(mpdUrl) {
    const ticket = ++state.ticket
    state.mpdUrl = mpdUrl
    state.top = []
    state.bottom = []
    try {
      const res = await fetch(mpdUrl)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const tracks = parseTextTracks(await res.text(), mpdUrl)
      if (ticket !== state.ticket) return
      state.tracks = tracks

      const topTrack = pickTrack(tracks, state.settings.top)
      const bottomTrack = pickTrack(tracks, state.settings.bottom)
      console.info(
        TAG,
        '字幕軌：' + (tracks.map((t) => t.lang + '(' + t.role + ')').join(', ') || '（無）'),
        '→ 上：' + (topTrack ? topTrack.lang : '無'),
        '下：' + (bottomTrack ? bottomTrack.lang : '無'),
      )

      const [top, bottom] = await Promise.all([fetchCues(topTrack), fetchCues(bottomTrack)])
      if (ticket !== state.ticket) return
      state.top = top
      state.bottom = bottom
      console.info(TAG, '載入完成：上 ' + top.length + ' 句／下 ' + bottom.length + ' 句')
    } catch (err) {
      console.warn(TAG, '載入字幕清單失敗：', err)
    }
  }

  // ── 發現清單檔 ────────────────────────────────────────────
  // 用 PerformanceObserver 而不是改寫 window.fetch：我們只需要「網址」，
  // 不需要動播放器的請求。buffered:true 會補上 observer 建立之前就發生的。
  function onResourceUrl(url) {
    if (isMpdUrl(url) && url !== state.mpdUrl) load(url)
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) onResourceUrl(e.name)
    }).observe({ type: 'resource', buffered: true })
  } catch (err) {
    console.warn(TAG, '無法觀察資源請求，字幕不會出現：', err)
  }

  // ── 每 100ms 對一次時間、更新畫面 ──────────────────────────
  const textOf = (cues) => cues.map((c) => c.text).join('\n')

  function tick() {
    if (!document.body) return
    if (!state.overlay) state.overlay = createOverlay()
    const ov = state.overlay
    const s = state.settings
    const video = document.querySelector('video')
    const onWatchPage = location.pathname.includes('/video/watch/')

    if (!s.enabled || !onWatchPage || !video || (!state.top.length && !state.bottom.length)) {
      ov.show(false)
      return
    }
    // 全螢幕時只有 fullscreenElement 的子孫看得到 —— 疊加層要搬進去
    const fs = document.fullscreenElement
    const host = fs && fs.tagName !== 'VIDEO' ? fs : document.body
    const t = video.currentTime + s.offsetMs / 1000
    ov.place(video, host, s.fontScale)
    ov.setText(textOf(activeAt(state.top, t)), textOf(activeAt(state.bottom, t)))
    ov.show(true)
  }
  setInterval(tick, TICK_MS)

  // ── 快捷鍵：Alt+Shift+ D 開關／↑↓ 字級／[ ] 時間偏移 ────────
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || !e.shiftKey) return
      const s = state.settings
      if (e.code === 'KeyD') s.enabled = !s.enabled
      else if (e.code === 'ArrowUp') s.fontScale = Math.min(2, +(s.fontScale + 0.1).toFixed(2))
      else if (e.code === 'ArrowDown') s.fontScale = Math.max(0.5, +(s.fontScale - 0.1).toFixed(2))
      else if (e.code === 'BracketLeft') s.offsetMs -= 100
      else if (e.code === 'BracketRight') s.offsetMs += 100
      else return
      e.preventDefault()
      saveSettings()
      console.info(TAG, '設定', JSON.stringify(s))
    },
    true,
  )

  // 除錯用：在 DevTools 的 console 打 __HDS__.state 看目前狀態
  window.__HDS__.state = state
  window.__HDS__.reload = () => state.mpdUrl && load(state.mpdUrl)
})()
