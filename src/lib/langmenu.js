/* 語言選單：播放器控制列上的一顆按鈕 ＋ 展開的選單面板。
 *
 * 規格見 doc/DESIGN.md「語言選單」：
 *   - 按鈕嵌入 HBO 控制列（字幕設定按鈕的左邊）；找不到控制列時退回浮動按鈕。
 *   - 選單分上排／下排兩欄，列出本集所有文字軌＋「關閉」，選了立即生效。
 *
 * 只管「按鈕與選單長什麼樣、放哪裡」，不抓字幕、不存設定 —— 選了什麼交給 onSelect，
 * 目前狀態由 getView() 問 main.js。
 *
 * ⚠️ 錨點只用 data-testid，不用 class：HBO 的 class 是 styled-components 雜湊，
 *    同一頁就有兩組（見 doc/gotchas/2026-11-11-同一頁有兩組控制列class雜湊不同.md）。
 * ⚠️ 按鈕與面板都不能放進疊加層 —— 疊加層必須 pointer-events:none（TECH「不變式」）。
 */
;(function (root) {
  'use strict'

  const ANCHOR = 'button[data-testid="player-ux-track-selector-button"]'
  const BTN_ID = 'hds-lang-button'
  const PANEL_ID = 'hds-lang-panel'
  // 控制列消失超過這麼久，才判定「嵌不進去」而改用浮動按鈕。避免控制列自動隱藏的空檔閃一下。假值。
  const FLOAT_AFTER_MS = 1500
  // 浮動按鈕：滑鼠停止移動這麼久後跟著隱藏（仿控制列）。假值。
  const FLOAT_IDLE_MS = 3000

  /* ── 純函式（node 可測） ─────────────────────────────── */

  let displayNames = null
  /** 語言代碼 → 繁中名稱，例 en-US → 英文（美國）。代碼不合法時退回代碼本身。 */
  function langName(lang) {
    try {
      displayNames = displayNames || new Intl.DisplayNames(['zh-Hant'], { type: 'language' })
      return displayNames.of(lang) || lang
    } catch {
      return lang || '未知語言'
    }
  }

  /** 選單上顯示的軌名稱：語言名稱，角色是 caption 時加「CC」（對齊 HBO 原生選單的「英文 CC」）。 */
  function trackLabel(track) {
    const name = langName(track.lang)
    return track.role === 'caption' ? name + ' CC' : name
  }

  /* ── DOM（只在瀏覽器裡呼叫） ─────────────────────────── */

  // 兩條橫線，上白下黃 —— 跟疊加層兩排的顏色一致，一眼看得出是「雙字幕」
  const ICON =
    '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
    '<rect x="2" y="3" width="20" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
    '<rect x="5.5" y="11" width="13" height="2.4" rx="1.2" fill="#ffffff"/>' +
    '<rect x="7.5" y="15.2" width="9" height="2.4" rx="1.2" fill="#ffe27a"/></svg>'

  const ROWS = [
    ['top', '上排（白）'],
    ['bottom', '下排（黃）'],
  ]

  /** 吃掉事件，不讓它冒泡到 HBO 播放器 —— 否則點選單可能被當成「點影片＝暫停」。 */
  function swallow(node) {
    for (const type of ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick']) {
      node.addEventListener(type, (e) => e.stopPropagation())
    }
  }

  function findAnchor() {
    for (const b of document.querySelectorAll(ANCHOR)) {
      const r = b.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return b
    }
    return null
  }

  /**
   * @param {object} o
   * @param {() => {status:string, tracks:object[], top:object|null, bottom:object|null}} o.getView
   * @param {(row:'top'|'bottom', track:object|null) => void} o.onSelect
   */
  function createLangMenu({ getView, onSelect }) {
    let mode = null //            'embedded' | 'floating'
    let open = false
    let lastAnchorAt = Date.now() // 起算時當作剛看過控制列，給頁面一點時間長出來
    let lastMoveAt = 0
    let sig = ''

    const button = document.createElement('button')
    button.id = BTN_ID
    button.type = 'button'
    button.setAttribute('aria-label', '雙字幕語言')
    button.title = '雙字幕語言'
    button.innerHTML = ICON
    Object.assign(button.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: '0',
      padding: '0',
      margin: '0',
      color: '#fff',
      cursor: 'pointer',
      flex: '0 0 auto',
    })
    swallow(button)
    button.addEventListener('click', () => (open ? close() : openPanel()))

    const panel = document.createElement('div')
    panel.id = PANEL_ID
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'none',
      gap: '28px',
      padding: '14px 18px',
      background: 'rgba(16,16,16,0.94)',
      color: '#fff',
      borderRadius: '8px',
      font: '14px/1.4 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      pointerEvents: 'auto',
      maxHeight: '70vh',
      overflowY: 'auto',
    })
    swallow(panel)

    window.addEventListener('mousemove', () => (lastMoveAt = Date.now()), { passive: true })
    // 點選單外面就關
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (open && !panel.contains(e.target) && !button.contains(e.target)) close()
      },
      true
    )
    window.addEventListener('keydown', (e) => {
      if (open && e.key === 'Escape') close()
    })

    function setMode(m) {
      mode = m
      if (m === 'floating') {
        Object.assign(button.style, {
          position: 'fixed',
          zIndex: '2147483647',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
        })
      } else {
        Object.assign(button.style, {
          position: '',
          zIndex: '',
          borderRadius: '',
          background: 'none',
        })
      }
    }

    function option(text, checked, onClick) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = (checked ? '✓ ' : ' ') + text
      Object.assign(b.style, {
        font: 'inherit', // 簡寫屬性，要放在 fontWeight 前面，否則會把粗體蓋掉
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: '0',
        padding: '5px 4px',
        color: checked ? '#fff' : 'rgba(255,255,255,0.72)',
        fontWeight: checked ? '700' : '400',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      })
      b.addEventListener('click', onClick)
      return b
    }

    function render(view) {
      panel.textContent = ''
      if (view.status !== 'ready' || !view.tracks.length) {
        const msg = document.createElement('div')
        msg.textContent =
          view.status === 'error'
            ? '讀取字幕清單失敗（見主控台 [HDS]）'
            : view.status === 'ready'
              ? '這集沒有字幕軌'
              : '讀取中…'
        panel.appendChild(msg)
        return
      }
      for (const [row, title] of ROWS) {
        const col = document.createElement('div')
        const h = document.createElement('div')
        h.textContent = title
        Object.assign(h.style, { fontSize: '12px', opacity: '0.6', marginBottom: '4px' })
        col.appendChild(h)
        const current = view[row]
        col.appendChild(option('關閉', !current, () => pick(row, null)))
        for (const t of view.tracks) {
          col.appendChild(option(trackLabel(t), !!current && current.id === t.id, () => pick(row, t)))
        }
        panel.appendChild(col)
      }
    }

    function signature(view) {
      const id = (t) => (t ? t.id : '-')
      return [view.status, view.tracks.map((t) => t.id).join(','), id(view.top), id(view.bottom)].join('|')
    }

    function pick(row, track) {
      onSelect(row, track)
      const view = getView()
      sig = signature(view)
      render(view)
    }

    function placePanel() {
      const r = button.getBoundingClientRect()
      if (!r.width) return // 控制列暫時收起來了，留在原位
      panel.style.right = Math.max(8, window.innerWidth - r.right) + 'px'
      panel.style.bottom = window.innerHeight - r.top + 10 + 'px'
    }

    function openPanel() {
      open = true
      const view = getView()
      sig = signature(view)
      render(view)
      panel.style.display = 'flex'
      placePanel()
    }

    function close() {
      open = false
      panel.style.display = 'none'
    }

    return {
      button,
      panel,
      /** 每個 tick 呼叫：確保按鈕在對的地方（React 重繪掉就插回去）、面板跟著更新。
       *  host：全螢幕時是 fullscreenElement，否則 body —— 跟疊加層同一個掛載點。 */
      update(video, host) {
        const now = Date.now()
        const anchor = findAnchor()
        if (anchor) {
          lastAnchorAt = now
          if (mode !== 'embedded') setMode('embedded')
          if (button.nextSibling !== anchor) anchor.parentElement.insertBefore(button, anchor)
          const w = anchor.offsetWidth + 'px'
          const h = anchor.offsetHeight + 'px'
          if (button.style.width !== w) button.style.width = w
          if (button.style.height !== h) button.style.height = h
          if (button.style.display !== 'inline-flex') button.style.display = 'inline-flex'
        } else if (now - lastAnchorAt > FLOAT_AFTER_MS) {
          if (mode !== 'floating') setMode('floating')
          if (button.parentElement !== host) host.appendChild(button)
          const r = video.getBoundingClientRect()
          button.style.left = r.right - 64 + 'px'
          button.style.top = r.bottom - 120 + 'px'
          const visible = open || now - lastMoveAt < FLOAT_IDLE_MS
          button.style.display = visible ? 'inline-flex' : 'none'
        }
        // 其餘情況：控制列剛收起來，按鈕跟著它一起消失，什麼都不做

        if (open) {
          if (panel.parentElement !== host) host.appendChild(panel)
          const view = getView()
          const s = signature(view)
          if (s !== sig) {
            sig = s
            render(view)
          }
          placePanel()
        }
      },
      /** 不在播放頁／沒有影片：收起面板、藏浮動按鈕（嵌入的那顆會跟著 HBO 控制列消失）。 */
      hide() {
        if (open) close()
        if (mode === 'floating') button.style.display = 'none'
      },
    }
  }

  const api = { langName, trackLabel, createLangMenu }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.__HDS__ = Object.assign(root.__HDS__ || {}, api)
})(typeof globalThis !== 'undefined' ? globalThis : this)
