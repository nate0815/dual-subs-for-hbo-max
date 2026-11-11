/* 字幕疊加層：兩行字（上＝主語言、下＝輔助語言），蓋在影片上方。
 * 只管「怎麼畫」，不知道字幕從哪來、也不讀影片時間 —— 那是 main.js 的事。 */
;(function (root) {
  'use strict'

  const ID = 'hds-overlay'

  // 字級 = 影片高度 × 這個比例 × 使用者的 fontScale（DESIGN「顯示規則」的「字級」）。假值，實機看了再調。
  // 上排是主字幕、較大；下排是副字幕、較小。
  const FONT_TOP = 0.046
  const FONT_BOTTOM = 0.034
  // 底部留白（佔影片**高度**的比例），規則見 DESIGN「顯示規則」的「底部留白」。全是假值。
  // ⚠️ 不能寫成 CSS 的 paddingBottom:'9%' —— padding 的百分比是相對**寬度**算的，
  //    寬螢幕上會變成高度的 18% 左右，字幕整個往上飄。一律算成 px。
  const PAD_LOW = 0.04 //      控制列收起時
  const PAD_GAP = 0.015 //     控制列出現時，字幕底部與控制列上緣的間距
  const PAD_FALLBACK = 0.09 // 偵測不到控制列時

  /** 字幕底部要離影片下緣多少 px。純函式。
   *  rect：影片的 { bottom, height }；ctl：控制列 { top, visible }，偵測不到給 null。 */
  function bottomPad(rect, ctl) {
    if (!ctl) return rect.height * PAD_FALLBACK
    const low = rect.height * PAD_LOW
    if (!ctl.visible) return low
    return Math.max(low, rect.bottom - ctl.top + rect.height * PAD_GAP)
  }

  const NBSP = ' '

  function line(color) {
    const d = document.createElement('div')
    // 依內容決定書寫方向：希伯來文、阿拉伯文等由右往左的語言，不設的話句尾標點會跑到另一端、
    // 夾雜的拉丁字母順序錯亂（Rick and Morty 希伯來文軌實測）。
    d.dir = 'auto'
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
      transition: 'padding-bottom 0.2s ease', // 跟著控制列上下移動時平滑過渡
    })
    const top = line('#ffe27a') // 上排黃（DESIGN「顯示規則」）
    const bottom = line('#ffffff') // 下排白
    el.append(top, bottom)

    /** on＝這一排有選語言（有軌）。有軌但此刻沒句子 → 保留一行空間、不顯示字，
     *  另一排才不會跟著上下跳（DESIGN「排的位置穩定」）。沒軌 → 整排收起。 */
    function setLine(node, text, on) {
      const shown = on ? text || NBSP : ''
      if (node.textContent !== shown) node.textContent = shown
      const display = on ? 'block' : 'none'
      if (node.style.display !== display) node.style.display = display
      const vis = text ? 'visible' : 'hidden'
      if (node.style.visibility !== vis) node.style.visibility = vis
    }

    return {
      el,
      setText(topText, bottomText, topOn = true, bottomOn = true) {
        setLine(top, topText, topOn)
        setLine(bottom, bottomText, bottomOn)
      },
      /** 對齊影片的畫面位置；host 是要掛在哪個元素底下（全螢幕時必須是 fullscreenElement）。
       *  ctl：控制列 { top, visible }，偵測不到給 null —— 決定底部留白。 */
      place(video, host, fontScale, ctl) {
        if (el.parentElement !== host) host.appendChild(el)
        const r = video.getBoundingClientRect()
        el.style.left = r.left + 'px'
        el.style.top = r.top + 'px'
        el.style.width = r.width + 'px'
        el.style.height = r.height + 'px'
        const pad = Math.round(bottomPad(r, ctl)) + 'px'
        if (el.style.paddingBottom !== pad) el.style.paddingBottom = pad
        top.style.fontSize = r.height * FONT_TOP * fontScale + 'px'
        bottom.style.fontSize = r.height * FONT_BOTTOM * fontScale + 'px'
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

  const api = { createOverlay, bottomPad }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.__HDS__ = Object.assign(root.__HDS__ || {}, api)
})(typeof globalThis !== 'undefined' ? globalThis : this)
