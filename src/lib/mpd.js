/* 從 DASH 清單檔（.mpd）找出文字軌（字幕）。
 *
 * 為什麼讀清單而不是攔截播放器的請求：播放器只會載入「使用者目前選的那一條」字幕，
 * 攔截只拿得到一條；清單檔則同時列出所有語言。見 doc/decisions/ 同名那則決策。
 *
 * 用正規表示式而不是 DOMParser：這樣能在 node 直接測，不必引入 DOM 相依。
 * 代價是只認得實測過的結構（AdaptationSet → Representation → SegmentTemplate）；
 * 結構變了會回傳空陣列，不會拋錯 —— 見 doc/TECH.md「不變式」。
 */
;(function (root) {
  'use strict'

  function isMpdUrl(url) {
    return /\.mpd(?:[?#]|$)/i.test(String(url))
  }

  const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

  /** XML 屬性值裡的 & 一律寫成 &amp;。網址的 query 有多個參數時必須還原，
   *  否則簽章參數會被黏壞。 */
  function decodeXml(s) {
    return s.replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => XML_ENTITIES[n])
  }

  /** 從一段開始標籤的屬性字串取出 name="..."。找不到回 null。 */
  function attr(attrs, name) {
    const m = String(attrs).match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'))
    return m ? decodeXml(m[1]) : null
  }

  /** 解析清單檔，回傳所有文字軌：
   *  [{ id, lang, role, segments, url, urls }]
   *  - urls：這條軌在**每個 Period** 的字幕檔網址，依 Period 順序。整集只有一段時就一個。
   *    各段字幕的時間碼都從整集開頭算（實測 Rick and Morty），所以全部抓下來接起來就對了。
   *  - url：urls[0]，相容舊呼叫端。
   *  - 同一 Period 內語言＋角色相同的第 n 條，與其他 Period 的第 n 條視為同一條軌。
   *  網址都相對於清單檔自己的網址解析。 */
  function parseTextTracks(xml, baseUrl) {
    const src = String(xml)
    // 沒有 <Period> 標籤（或結構看不懂）就把整份當成一段
    const periods = src.match(/<Period\b[\s\S]*?<\/Period>/g) || [src]
    const merged = []
    const byKey = new Map()
    for (const period of periods) {
      const seen = new Map() // 這一段裡 lang|role 出現第幾次
      for (const t of parsePeriod(period, baseUrl)) {
        const base = t.lang + '|' + t.role
        const n = (seen.get(base) || 0) + 1
        seen.set(base, n)
        const key = base + '|' + n
        const hit = byKey.get(key)
        if (hit) {
          hit.urls.push(t.url)
        } else {
          const track = { ...t, urls: [t.url] }
          byKey.set(key, track)
          merged.push(track)
        }
      }
    }
    return merged
  }

  /** 一個 Period（或整份清單）裡的文字軌，每個 AdaptationSet 一條。 */
  function parsePeriod(xml, baseUrl) {
    const tracks = []
    const setRe = /<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/g
    let m
    while ((m = setRe.exec(String(xml)))) {
      const setAttrs = m[1]
      const body = m[2]
      const rep = body.match(/<Representation\b([^>]*)>/)
      const repAttrs = rep ? rep[1] : ''
      const mime = attr(repAttrs, 'mimeType') || attr(setAttrs, 'mimeType') || ''
      const isText = attr(setAttrs, 'contentType') === 'text' || /vtt/i.test(mime)
      if (!isText) continue

      const tpl = body.match(/<SegmentTemplate\b([^>]*)>/)
      const media = tpl && attr(tpl[1], 'media')
      if (!media) continue
      const startNumber = Number(attr(tpl[1], 'startNumber') || 1)
      // <S ...> 是 SegmentTimeline 的分段；注意 \b 讓它不會誤中 <SegmentTemplate>
      const segments = (body.match(/<S\b/g) || []).length || 1
      const role = body.match(/<Role\b([^>]*)>/)

      tracks.push({
        id: attr(repAttrs, 'id'),
        lang: attr(setAttrs, 'lang') || '',
        role: role ? attr(role[1], 'value') : null,
        segments,
        url: new URL(media.replace('$Number$', String(startNumber)), baseUrl).href,
      })
    }
    return tracks
  }

  /** 依語言前綴挑一條軌。前綴依序嘗試，先中先贏：['zh-hant','zh'] 先找繁中、找不到再找任何中文。
   *  比對不分大小寫，只比「開頭」。都沒有回 null。 */
  function pickTrack(tracks, langPrefixes) {
    for (const p of langPrefixes) {
      const hit = tracks.find((t) => t.lang.toLowerCase().startsWith(String(p).toLowerCase()))
      if (hit) return hit
    }
    return null
  }

  /** 依設定值挑軌。設定值有三種形狀（見 doc/TECH.md「核心資料契約」）：
   *  - 陣列：語言前綴清單（預設值）→ 交給 pickTrack
   *  - { lang, role }：使用者在語言選單選的那條 → 語言完全相同（不分大小寫）者優先挑同角色，
   *    沒有同角色就挑同語言的第一條；語言不同一律不算（DESIGN：不自動改用別的語言）
   *  - null／其他：關閉 → null */
  function resolveTrack(tracks, pref) {
    if (Array.isArray(pref)) return pickTrack(tracks, pref)
    if (!pref || typeof pref !== 'object' || !pref.lang) return null
    const lang = String(pref.lang).toLowerCase()
    const same = tracks.filter((t) => t.lang.toLowerCase() === lang)
    return same.find((t) => t.role === pref.role) || same[0] || null
  }

  const api = { isMpdUrl, parseTextTracks, pickTrack, resolveTrack }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.__HDS__ = Object.assign(root.__HDS__ || {}, api)
})(typeof globalThis !== 'undefined' ? globalThis : this)
