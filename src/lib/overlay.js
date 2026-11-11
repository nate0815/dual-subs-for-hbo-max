/* 字幕疊加層：兩行字（上＝主語言、下＝輔助語言），蓋在影片上方。
 * 只管「怎麼畫」，不知道字幕從哪來、也不讀影片時間 —— 那是 main.js 的事。 */
;(function (root) {
  'use strict'

  const ID = 'hds-overlay'

  // 字級 = 影片高度 × 這個比例 × 使用者的 fontScale。假值，實機看了再調。
  const FONT_RATIO = 0.04
  // 疊加層底部留給播放器控制列的空間（佔影片高度的比例）。假值。
  const BOTTOM_PAD = '9%'

  function line(color) {
    const d = document.createElement('div')
    Object.assign(d.style, {
      color,
      fontFamily: '"Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif',
      fontWeight: '600',
      lineHeight: '1.25',
      textAlign: 'center',
      whiteSpace: 'pre-line',
      maxWidth: '86%',
      margin: '0.12em 0',
      // 黑色描邊靠多層陰影疊出來，不吃影片底色
      textShadow: '0 0 4px #000, 0 0 4px #000, 1px 1px 2px #000, -1px -1px 2px #000',
      display: 'none',
    })
    return d
  }

  function createOverlay() {
    const el = document.createElement('div')
    el.id = ID
    Object.assign(el.style, {
      position: 'fixed',
      zIndex: '2147483647',
      // ⚠️ 一定要 none，否則會蓋住播放器的控制列，點不到
      pointerEvents: 'none',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      boxSizing: 'border-box',
      paddingBottom: BOTTOM_PAD,
    })
    const top = line('#ffffff')
    const bottom = line('#ffe27a')
    el.append(top, bottom)

    function setLine(node, text) {
      if (node.textContent !== text) node.textContent = text
      node.style.display = text ? 'block' : 'none'
    }

    return {
      el,
      setText(topText, bottomText) {
        setLine(top, topText)
        setLine(bottom, bottomText)
      },
      /** 對齊影片的畫面位置；host 是要掛在哪個元素底下（全螢幕時必須是 fullscreenElement）。 */
      place(video, host, fontScale) {
        if (el.parentElement !== host) host.appendChild(el)
        const r = video.getBoundingClientRect()
        el.style.left = r.left + 'px'
        el.style.top = r.top + 'px'
        el.style.width = r.width + 'px'
        el.style.height = r.height + 'px'
        const base = r.height * FONT_RATIO * fontScale
        top.style.fontSize = base + 'px'
        bottom.style.fontSize = base * 1.1 + 'px'
      },
      show(flag) {
        const v = flag ? 'flex' : 'none'
        if (el.style.display !== v) el.style.display = v
      },
      remove() {
        el.remove()
      },
    }
  }

  const api = { createOverlay }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.__HDS__ = Object.assign(root.__HDS__ || {}, api)
})(typeof globalThis !== 'undefined' ? globalThis : this)
