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
  // 快捷鍵提示顯示多久（DESIGN「快捷鍵」：約 1.5 秒）。
  const TOAST_MS = 1500

  /* ── 純函式（node 可測） ─────────────────────────────── */

  /** 拿掉「該語言本來就用這種文字」的多餘文字標記，例 ja-Jpan → ja（否則名稱變成「日文（日文）」）。
   *  中文例外：繁體／簡體正是用來分軌的資訊（DESIGN「軌的名稱」例「中文（繁體，台灣）」），一律保留。
   *  地區永遠保留。 */
  function dropDefaultScript(lang) {
    const loc = new Intl.Locale(lang)
    if (!loc.script || loc.language === 'zh') return lang
    if (new Intl.Locale(loc.language).maximize().script !== loc.script) return lang
    return loc.region ? loc.language + '-' + loc.region : loc.language
  }

  let displayNames = null
  /** 語言代碼 → 繁中名稱，例 en-US → 英文（美國）。代碼不合法時退回代碼本身。 */
  function langName(lang) {
    try {
      displayNames = displayNames || new Intl.DisplayNames(['zh-Hant'], { type: 'language' })
      return displayNames.of(dropDefaultScript(lang)) || lang
    } catch {
      return lang || '未知語言'
    }
  }

  /** 選單上顯示的軌名稱：語言名稱，角色是 caption 時加「CC」（對齊 HBO 原生選單的「英文 CC」）。 */
  function trackLabel(track) {
    const name = langName(track.lang)
    return track.role === 'caption' ? name + ' CC' : name
  }

  /** 時間偏移的提示文字。offsetMs 正值＝字幕提早（與 main.js 的設定同義）。 */
  function formatOffset(offsetMs) {
    const sec = (Math.abs(offsetMs) / 1000).toFixed(1)
    if (offsetMs > 0) return '字幕提早 ' + sec + ' 秒'
    if (offsetMs < 0) return '字幕延後 ' + sec + ' 秒'
    return '字幕時間：不偏移'
  }

  // 本工具自己的快捷鍵（DESIGN「快捷鍵」）。選單底部列出來 —— 不寫出來使用者不會知道。
  const HOTKEYS = [
    ['Alt+Shift+D', '開／關雙字幕'],
    ['Alt+Shift+↑ / ↓', '字級大／小'],
    ['Alt+Shift+[ / ]', '字幕延後／提早 0.1 秒'],
  ]

  /* ── DOM（只在瀏覽器裡呼叫） ─────────────────────────── */

  // 珊瑚紅實心圓＋白色「雙」字（DESIGN「按鈕外觀」）—— 刻意跟 HBO 的白色線條圖示不同，一眼找得到。
  // 顏色、字級是假值。
  const ICON_COLOR = '#ff5a4e'
  const ICON =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="11.5" fill="' + ICON_COLOR + '"/>' +
    '<text x="12" y="16.6" text-anchor="middle" font-size="13.5" font-weight="900" fill="#fff" ' +
    'font-family="&quot;Noto Sans TC&quot;,&quot;Microsoft JhengHei&quot;,&quot;PingFang TC&quot;,sans-serif">雙</text></svg>'

  const ROWS = [
    ['top', '上排（黃）'],
    ['bottom', '下排（白）'],
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

  /** 元素與它的祖先都看得見（沒有 display:none／visibility:hidden／幾乎透明）。 */
  function isShown(el) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false
    }
    return true
  }

  /** HBO 的「集數／您可能也會喜歡」面板是否打開（DESIGN「HBO 選集面板打開時」）。
   *  面板平常就在 DOM 裡，只是 visibility:hidden ＋ opacity:0，所以要看樣式不能只看存在。
   *  找不到 → false（照常顯示字幕，不因改版而把字幕藏掉）。 */
  function drawerOpen() {
    const d = document.querySelector('[data-testid="player_drawer"]')
    return !!d && isShown(d)
  }

  let controlsSeen = false
  /** 控制列的位置與是否看得見 → { top, visible }；從沒看過控制列則回 null（呼叫端退回固定留白）。
   *  給疊加層決定字幕要不要讓開（DESIGN「底部留白」）。放在這裡是因為它跟語言按鈕一樣依賴 HBO 頁面結構。
   *  看得見與否：控制列收起時 HBO 可能是淡出（opacity）也可能整個拔掉，兩種都要認。 */
  function findControls() {
    const anchor = findAnchor()
    const footer = anchor && anchor.closest('[data-testid="control_footer"]')
    if (!footer) return controlsSeen ? { top: 0, visible: false } : null
    controlsSeen = true
    if (!isShown(footer)) return { top: 0, visible: false }
    return { top: footer.getBoundingClientRect().top, visible: true }
  }

  /**
   * @param {object} o
   * @param {() => {status:string, enabled:boolean, tracks:object[], top:object|null, bottom:object|null}} o.getView
   * @param {(row:'top'|'bottom', track:object|null) => void} o.onSelect
   */
  function createLangMenu({ getView, onSelect }) {
    let mode = null //            'embedded' | 'floating'
    let open = false
    let lastAnchorAt = Date.now() // 起算時當作剛看過控制列，給頁面一點時間長出來
    let lastMoveAt = 0
    let sig = ''
    let lastHost = null
    let lastVideo = null
    let toastTimer = 0

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
      flexDirection: 'column',
      gap: '10px',
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

    // 快捷鍵按下後的短暫提示。不吃滑鼠（pointer-events:none），也不放進疊加層 ——
    // 疊加層在「關閉」時整個隱藏，但「雙字幕：關」這句正是那時候要看到的。
    const toast = document.createElement('div')
    toast.id = 'hds-toast'
    Object.assign(toast.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'none',
      transform: 'translateX(-50%)',
      padding: '8px 16px',
      background: 'rgba(16,16,16,0.85)',
      color: '#fff',
      borderRadius: '6px',
      font: '15px/1.4 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    })

    window.addEventListener('mousemove', () => (lastMoveAt = Date.now()), { passive: true })
    // 點選單外面就關
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (open && !panel.contains(e.target) && !button.contains(e.target)) close()
      },
      true
    )
    // 捕獲階段：播放中 HBO 播放器會先吃掉 Esc（實機驗收時發現冒泡階段收不到）。
    // 選單開著時 Esc 只關選單、不往下傳 —— 否則全螢幕下按 Esc 會連全螢幕一起退出。
    window.addEventListener(
      'keydown',
      (e) => {
        if (open && e.key === 'Escape') {
          e.stopPropagation()
          close()
        }
      },
      true
    )

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
      if (!view.enabled) {
        const off = document.createElement('div')
        off.textContent = '雙字幕目前關閉 —— 按 Alt+Shift+D 開啟'
        Object.assign(off.style, { color: '#ffe27a', fontSize: '13px' })
        panel.appendChild(off)
      }
      panel.appendChild(renderBody(view))
      const foot = document.createElement('div')
      Object.assign(foot.style, {
        fontSize: '12px',
        opacity: '0.6',
        borderTop: '1px solid rgba(255,255,255,0.15)',
        paddingTop: '8px',
        lineHeight: '1.6',
      })
      for (const [key, what] of HOTKEYS) {
        const line = document.createElement('div')
        line.textContent = key + '　' + what
        foot.appendChild(line)
      }
      panel.appendChild(foot)
    }

    function renderBody(view) {
      if (view.status !== 'ready' || !view.tracks.length) {
        const msg = document.createElement('div')
        msg.textContent =
          view.status === 'error'
            ? '讀取字幕清單失敗（見主控台 [HDS]）'
            : view.status === 'ready'
              ? '這集沒有字幕軌'
              : '讀取中…'
        return msg
      }
      const cols = document.createElement('div')
      Object.assign(cols.style, { display: 'flex', gap: '28px' })
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
        cols.appendChild(col)
      }
      return cols
    }

    function signature(view) {
      const id = (t) => (t ? t.id : '-')
      return [view.status, view.enabled, view.tracks.map((t) => t.id).join(','), id(view.top), id(view.bottom)].join('|')
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
        lastHost = host
        lastVideo = video
        const opacity = getView().enabled ? '1' : '0.45' // 疊加層關閉時圖示變淡
        if (button.style.opacity !== opacity) button.style.opacity = opacity
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
        toast.style.display = 'none'
      },
      /** 在影片上方中央短暫顯示一句提示（快捷鍵的回饋）。 */
      flash(text) {
        const host = lastHost || document.body
        if (!host) return
        if (toast.parentElement !== host) host.appendChild(toast)
        const r = lastVideo && lastVideo.isConnected ? lastVideo.getBoundingClientRect() : null
        toast.style.left = (r ? r.left + r.width / 2 : window.innerWidth / 2) + 'px'
        toast.style.top = (r ? r.top + r.height * 0.08 : 40) + 'px'
        toast.textContent = text
        toast.style.display = 'block'
        clearTimeout(toastTimer)
        toastTimer = setTimeout(() => (toast.style.display = 'none'), TOAST_MS)
      },
    }
  }

  const api = { langName, trackLabel, formatOffset, createLangMenu, findControls, drawerOpen }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.__HDS__ = Object.assign(root.__HDS__ || {}, api)
})(typeof globalThis !== 'undefined' ? globalThis : this)
