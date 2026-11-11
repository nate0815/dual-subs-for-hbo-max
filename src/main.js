/* 進入點：發現清單檔 → 取兩條字幕 → 依影片時間畫在疊加層上。
 *
 * 在 manifest 裡以 world:"MAIN" 注入（跟網頁同一個 JS 環境），
 * 載入順序固定為 vtt → mpd → overlay → main，所以這裡一開頭就能從 __HDS__ 解構。
 */
;(function () {
  'use strict'

  const {
    parseVtt,
    activeAt,
    isMpdUrl,
    parseTextTracks,
    resolveTrack,
    createOverlay,
    createLangMenu,
    formatOffset,
    findControls,
    drawerOpen,
  } = window.__HDS__

  const TAG = '[HDS]'
  const KEY = 'hds:settings'
  const TICK_MS = 100

  // top／bottom 三種形狀：語言前綴陣列（預設）、{lang, role}（使用者在選單選的）、null（關閉）。
  // 解讀規則在 mpd.js 的 resolveTrack。選擇是全域的，套用到之後每一集。
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
    ticket: 0, //     換集／改選語言時用來丟掉舊的非同步結果
    status: 'idle', // idle | loading | ready | error —— 給語言選單顯示用
    tracks: [],
    topTrack: null,
    bottomTrack: null,
    top: [], //       句子陣列
    bottom: [],
    cache: new Map(), // 軌網址 → 句子陣列。只在記憶體、換集就清（TECH「不變式」：字幕不持久化）
    overlay: null,
    menu: null,
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
    if (state.cache.has(track.url)) return state.cache.get(track.url)
    if (track.segments > 1) {
      console.warn(TAG, '這條字幕軌有多個分段，目前只讀第一段：', track.lang)
    }
    try {
      const res = await fetch(track.url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const cues = parseVtt(await res.text())
      state.cache.set(track.url, cues)
      return cues
    } catch (err) {
      console.warn(TAG, '抓字幕失敗：', track.lang, err)
      return []
    }
  }

  /** 依目前設定挑上下兩條軌並抓字幕。換集與改選語言都走這裡。 */
  async function loadCues(ticket) {
    const topTrack = resolveTrack(state.tracks, state.settings.top)
    const bottomTrack = resolveTrack(state.tracks, state.settings.bottom)
    state.topTrack = topTrack
    state.bottomTrack = bottomTrack
    const [top, bottom] = await Promise.all([fetchCues(topTrack), fetchCues(bottomTrack)])
    if (ticket !== state.ticket) return
    state.top = top
    state.bottom = bottom
    console.info(
      TAG,
      '上：' + (topTrack ? topTrack.lang + ' ' + top.length + ' 句' : '無'),
      '／下：' + (bottomTrack ? bottomTrack.lang + ' ' + bottom.length + ' 句' : '無'),
    )
  }

  async function load(mpdUrl) {
    const ticket = ++state.ticket
    state.mpdUrl = mpdUrl
    state.status = 'loading'
    state.tracks = []
    state.topTrack = state.bottomTrack = null
    state.top = []
    state.bottom = []
    state.cache.clear()
    try {
      const res = await fetch(mpdUrl)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const tracks = parseTextTracks(await res.text(), mpdUrl)
      if (ticket !== state.ticket) return
      state.tracks = tracks
      state.status = 'ready'
      console.info(TAG, '字幕軌：' + (tracks.map((t) => t.lang + '(' + t.role + ')').join(', ') || '（無）'))
      await loadCues(ticket)
    } catch (err) {
      if (ticket === state.ticket) state.status = 'error'
      console.warn(TAG, '載入字幕清單失敗：', err)
    }
  }

  /** 語言選單選了某條軌（或 null＝關閉）。存成全域偏好，立即重抓。 */
  function onSelect(row, track) {
    state.settings[row] = track ? { lang: track.lang, role: track.role } : null
    saveSettings()
    state[row] = [] // 舊語言立刻消失，不要在新字幕回來前繼續顯示
    loadCues(++state.ticket)
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
    if (!state.menu) {
      state.menu = createLangMenu({
        getView: () => ({
          status: state.status,
          enabled: state.settings.enabled,
          tracks: state.tracks,
          top: state.topTrack,
          bottom: state.bottomTrack,
        }),
        onSelect,
      })
    }
    const ov = state.overlay
    const s = state.settings
    const video = document.querySelector('video')
    const onWatchPage = location.pathname.includes('/video/watch/')

    if (!onWatchPage || !video) {
      ov.show(false)
      state.menu.hide()
      return
    }
    // 全螢幕時只有 fullscreenElement 的子孫看得到 —— 疊加層與選單面板都要搬進去
    const fs = document.fullscreenElement
    const host = fs && fs.tagName !== 'VIDEO' ? fs : document.body
    // 語言按鈕不受「開關」影響：關掉疊加層時，仍要能從按鈕改語言
    state.menu.update(video, host)

    // 選集面板打開時不顯示字幕，免得擋住集數說明（DESIGN「HBO 選集面板打開時」）
    if (!s.enabled || drawerOpen() || (!state.top.length && !state.bottom.length)) {
      ov.show(false)
      return
    }
    const t = video.currentTime + s.offsetMs / 1000
    // 控制列出現時字幕讓到它上方、收起時貼近下緣（DESIGN「底部留白」）
    ov.place(video, host, s.fontScale, findControls())
    // 有選軌的那排即使此刻沒句子也保留空間，另一排才不會跳（DESIGN「排的位置穩定」）
    ov.setText(
      textOf(activeAt(state.top, t)),
      textOf(activeAt(state.bottom, t)),
      !!state.topTrack,
      !!state.bottomTrack,
    )
    ov.show(true)
  }
  setInterval(tick, TICK_MS)

  // ── 快捷鍵：Alt+Shift+ D 開關／↑↓ 字級／[ ] 時間偏移 ────────
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || !e.shiftKey) return
      const s = state.settings
      let msg
      if (e.code === 'KeyD') {
        s.enabled = !s.enabled
        msg = '雙字幕：' + (s.enabled ? '開' : '關')
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        const step = e.code === 'ArrowUp' ? 0.1 : -0.1
        s.fontScale = Math.min(2, Math.max(0.5, +(s.fontScale + step).toFixed(2)))
        msg = '字級 ×' + s.fontScale
      } else if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        s.offsetMs += e.code === 'BracketRight' ? 100 : -100
        msg = formatOffset(s.offsetMs)
      } else return
      e.preventDefault()
      saveSettings()
      // 快捷鍵是本工具自己的，按了沒回饋會以為壞掉（DESIGN「快捷鍵」）
      if (state.menu) state.menu.flash(msg)
      console.info(TAG, '設定', JSON.stringify(s))
    },
    true,
  )

  // 除錯用：在 DevTools 的 console 打 __HDS__.state 看目前狀態
  window.__HDS__.state = state
  window.__HDS__.reload = () => state.mpdUrl && load(state.mpdUrl)
})()
