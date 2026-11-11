/* WebVTT 解析，以及「某一時刻有哪些字幕在顯示」。
 *
 * 純函式，不碰 DOM —— 所以能直接用 node 測（test/vtt.test.js）。
 * 在擴充功能裡它掛在 window.__HDS__ 底下；在 node 裡走 module.exports。
 */
;(function (root) {
  'use strict'

  /** "HH:MM:SS.mmm" 或 "MM:SS.mmm" → 秒。格式不對回 NaN。 */
  function toSeconds(ts) {
    const parts = String(ts).trim().replace(',', '.').split(':')
    if (parts.length < 2 || parts.length > 3) return NaN
    const nums = parts.map(Number)
    if (nums.some(Number.isNaN)) return NaN
    const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]]
    return h * 3600 + m * 60 + s
  }

  const ENTITIES = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&lrm;': '', '&rlm;': '',
  }

  /** 去掉 <i> <b> <c.xxx> <00:00:01.000> 等標記、還原 HTML 實體、逐行 trim。
   *  順序不能反：先去標記、再還原實體，否則字幕裡寫的 &lt;i&gt; 會被當成標記吃掉。 */
  function cleanText(raw) {
    return String(raw)
      .replace(/<[^>]*>/g, '')
      .replace(/&(?:amp|lt|gt|quot|apos|nbsp|lrm|rlm|#39);/g, (m) => ENTITIES[m])
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n')
  }

  /** VTT 全文 → [{start, end, text}]，依 start 排序。
   *  WEBVTT 標頭、NOTE／STYLE／REGION 區塊沒有 "-->" 行，會被自然略過。 */
  function parseVtt(text) {
    const blocks = String(text)
      .replace(/^﻿/, '')
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
    const cues = []
    for (const block of blocks) {
      const lines = block.split('\n')
      const i = lines.findIndex((l) => l.includes('-->'))
      if (i < 0) continue
      const m = lines[i].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/)
      if (!m) continue
      const start = toSeconds(m[1])
      const end = toSeconds(m[2])
      if (Number.isNaN(start) || Number.isNaN(end)) continue
      const body = cleanText(lines.slice(i + 1).join('\n'))
      if (!body) continue
      cues.push({ start, end, text: body })
    }
    return cues.sort((a, b) => a.start - b.start)
  }

  /** 往回看幾筆。字幕可能重疊（上一句還沒結束、下一句已開始），
   *  二分搜尋只找得到「最後一個開始的」，所以要往前掃一小段補上重疊的。 */
  const LOOKBACK = 12

  /** cues 必須已依 start 排序（parseVtt 的輸出就是）。回傳時刻 t 正在顯示的字幕。 */
  function activeAt(cues, t) {
    let lo = 0
    let hi = cues.length - 1
    let idx = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (cues[mid].start <= t) {
        idx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    const out = []
    for (let i = idx; i >= 0 && i > idx - LOOKBACK; i--) {
      if (cues[i].end > t) out.push(cues[i])
    }
    return out.reverse()
  }

  const api = { toSeconds, cleanText, parseVtt, activeAt }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.__HDS__ = Object.assign(root.__HDS__ || {}, api)
})(typeof globalThis !== 'undefined' ? globalThis : this)
