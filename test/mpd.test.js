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
