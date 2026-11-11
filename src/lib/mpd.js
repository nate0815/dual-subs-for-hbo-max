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
   *  [{ id, lang, role, segments, url }]
   *  url 是第一個分段（startNumber）的完整網址，相對於清單檔自己的網址解析。 */
  function parseTextTracks(xml, baseUrl) {
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

  const api = { isMpdUrl, parseTextTracks, pickTrack }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.__HDS__ = Object.assign(root.__HDS__ || {}, api)
})(typeof globalThis !== 'undefined' ? globalThis : this)
