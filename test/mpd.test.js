const test = require('node:test')
const assert = require('node:assert/strict')
const { isMpdUrl, parseTextTracks, pickTrack, resolveTrack } = require('../src/lib/mpd.js')

// 結構照 2026-11-11 對 HBO Max 台灣版實測到的清單檔，網址與簽章都是編的。
const BASE = 'https://cdn.example.test/abc-123/fallback.mpd?token=x'
const MPD = `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static"><Period>
  <AdaptationSet id="1" lang="en-US" contentType="audio">
    <Representation id="a1" mimeType="audio/mp4"><BaseURL>a/1/a1.mp4</BaseURL></Representation>
  </AdaptationSet>
  <AdaptationSet id="17" segmentAlignment="true" lang="en-US" contentType="text">
    <Role schemeIdUri="urn:mpeg:dash:role:2011" value="caption"/>
    <Representation mimeType="text/vtt" bandwidth="30" id="t0">
      <SegmentTemplate media="t/00c8aa/t0/$Number$.vtt?a=1&amp;b=2" startNumber="1" timescale="1000">
        <SegmentTimeline><S t="0" d="707400"/></SegmentTimeline>
      </SegmentTemplate>
    </Representation>
  </AdaptationSet>
  <AdaptationSet id="18" segmentAlignment="true" lang="zh-Hant-TW" contentType="text">
    <Role schemeIdUri="urn:mpeg:dash:role:2011" value="subtitle"/>
    <Representation mimeType="text/vtt" bandwidth="25" id="t1">
      <SegmentTemplate media="t/00c8aa/t1/$Number$.vtt?a=1&amp;b=2" startNumber="1" timescale="1000">
        <SegmentTimeline><S t="0" d="707400"/></SegmentTimeline>
      </SegmentTemplate>
    </Representation>
  </AdaptationSet>
  <AdaptationSet id="19" contentType="image">
    <Representation id="i0"><SegmentTemplate media="i/3b/images-$Number$.jpg" startNumber="1"/></Representation>
  </AdaptationSet>
</Period></MPD>`

test('isMpdUrl', () => {
  assert.ok(isMpdUrl('https://x.test/a/b.mpd'))
  assert.ok(isMpdUrl('https://x.test/a/b.mpd?x=1'))
  assert.ok(!isMpdUrl('https://x.test/a/b.mp4'))
  assert.ok(!isMpdUrl('https://x.test/a/mpd/segment.m4s'))
})

test('parseTextTracks：只取文字軌，不取音軌與縮圖', () => {
  const tracks = parseTextTracks(MPD, BASE)
  assert.deepEqual(tracks.map((t) => [t.id, t.lang, t.role]), [
    ['t0', 'en-US', 'caption'],
    ['t1', 'zh-Hant-TW', 'subtitle'],
  ])
})

test('parseTextTracks：網址相對於清單檔解析，$Number$ 換成 startNumber，&amp; 還原成 &', () => {
  const [en] = parseTextTracks(MPD, BASE)
  assert.equal(en.url, 'https://cdn.example.test/abc-123/t/00c8aa/t0/1.vtt?a=1&b=2')
  assert.equal(en.segments, 1)
})

test('parseTextTracks：結構看不懂時回空陣列，不拋錯', () => {
  assert.deepEqual(parseTextTracks('<MPD></MPD>', BASE), [])
  assert.deepEqual(parseTextTracks('', BASE), [])
})

test('pickTrack：前綴依序嘗試、不分大小寫、都沒有回 null', () => {
  const tracks = parseTextTracks(MPD, BASE)
  assert.equal(pickTrack(tracks, ['en']).id, 't0')
  assert.equal(pickTrack(tracks, ['zh-hant', 'zh']).id, 't1')
  assert.equal(pickTrack(tracks, ['ja', 'zh']).id, 't1') // 先找日文沒有，退到中文
  assert.equal(pickTrack(tracks, ['ja']), null)
})

test('resolveTrack：陣列＝預設值，照 pickTrack 的前綴規則', () => {
  const tracks = parseTextTracks(MPD, BASE)
  assert.equal(resolveTrack(tracks, ['zh-hant', 'zh']).id, 't1')
})

test('resolveTrack：{lang, role}＝使用者選的，語言要完全相同、優先同角色', () => {
  const tracks = [
    { id: 'a', lang: 'en-US', role: 'subtitle' },
    { id: 'b', lang: 'en-US', role: 'caption' },
    { id: 'c', lang: 'zh-Hant-TW', role: 'subtitle' },
  ]
  assert.equal(resolveTrack(tracks, { lang: 'en-US', role: 'caption' }).id, 'b')
  assert.equal(resolveTrack(tracks, { lang: 'EN-us', role: 'caption' }).id, 'b') // 不分大小寫
  assert.equal(resolveTrack(tracks, { lang: 'en-US', role: 'forced' }).id, 'a') // 沒有同角色 → 同語言第一條
})

test('resolveTrack：選的語言這集沒有 → null，不退到別的語言', () => {
  const tracks = parseTextTracks(MPD, BASE)
  assert.equal(resolveTrack(tracks, { lang: 'zh-Hant', role: 'subtitle' }), null) // 只有 zh-Hant-TW，不算
  assert.equal(resolveTrack(tracks, { lang: 'ja', role: 'subtitle' }), null)
})

test('resolveTrack：null／壞掉的設定值＝關閉', () => {
  const tracks = parseTextTracks(MPD, BASE)
  assert.equal(resolveTrack(tracks, null), null)
  assert.equal(resolveTrack(tracks, undefined), null)
  assert.equal(resolveTrack(tracks, { role: 'caption' }), null)
  assert.equal(resolveTrack(tracks, 'en'), null)
})

// 多 Period 的清單檔：結構照 2026-11-11 實測 Rick and Morty（一集 3 段、各段一個字幕檔、
// SegmentTemplate 的 startNumber 依段遞增），網址與 id 都是編的。
const textSet = (lang, role, n, pto) => `
  <AdaptationSet lang="${lang}" contentType="text"><Role schemeIdUri="urn:mpeg:dash:role:2011" value="${role}"/>
    <Representation mimeType="text/vtt" id="${lang}-${n}">
      <SegmentTemplate media="t/${lang}/$Number$.vtt?a=1&amp;b=2" startNumber="${n}" timescale="1000"${pto ? ` presentationTimeOffset="${pto}"` : ''}>
        <SegmentTimeline><S t="0" d="1000"/></SegmentTimeline>
      </SegmentTemplate></Representation></AdaptationSet>`
const period = (id, n, pto, langs) =>
  `<Period id="${id}">${langs.map(([l, r]) => textSet(l, r, n, pto)).join('')}</Period>`
const LANGS = [['zh-Hant-HK', 'subtitle'], ['zh-Hant-TW', 'subtitle'], ['en-US', 'caption']]
const MULTI = `<?xml version="1.0"?><MPD>${period('0', 1, 0, LANGS)}${period('1', 2, 729228, LANGS)}${period('2', 3, 1158740, LANGS)}</MPD>`

test('parseTextTracks：多個 Period 時，同語言同角色合併成一條軌，urls 依段排序', () => {
  const tracks = parseTextTracks(MULTI, BASE)
  assert.deepEqual(tracks.map((t) => t.lang), ['zh-Hant-HK', 'zh-Hant-TW', 'en-US']) // 不重複
  const en = tracks.find((t) => t.lang === 'en-US')
  assert.deepEqual(
    en.urls.map((u) => new URL(u).pathname.split('/').slice(-1)[0]),
    ['1.vtt', '2.vtt', '3.vtt']
  )
  assert.equal(en.url, en.urls[0])
  assert.ok(en.urls.every((u) => u.endsWith('?a=1&b=2')), '每段網址都要還原 &amp; 並保留查詢字串')
})

test('parseTextTracks：只有一段時 urls 只有一個（Adventure Time 那種）', () => {
  const [en] = parseTextTracks(MPD, BASE)
  assert.deepEqual(en.urls, [en.url])
})

test('pickTrack：預設下排同時有香港與台灣繁中時挑台灣', () => {
  const tracks = parseTextTracks(MULTI, BASE)
  assert.equal(pickTrack(tracks, ['zh-hant-tw', 'zh-hant', 'zh']).lang, 'zh-Hant-TW')
  // 只有香港繁中時退到它
  const hkOnly = tracks.filter((t) => t.lang !== 'zh-Hant-TW')
  assert.equal(pickTrack(hkOnly, ['zh-hant-tw', 'zh-hant', 'zh']).lang, 'zh-Hant-HK')
})
