const test = require('node:test')
const assert = require('node:assert/strict')
const { toSeconds, cleanText, parseVtt, mergeCues, activeAt } = require('../src/lib/vtt.js')

// 字幕內容都是自己編的，不放任何真實作品的台詞。
const SAMPLE = [
  'WEBVTT',
  '',
  'NOTE 這是註解區塊，沒有時間行，應該被略過',
  '',
  '1',
  '00:00:01.000 --> 00:00:03.000 position:50%',
  'Hello <i>there</i>',
  '',
  '00:00:02.500 --> 00:00:05.000',
  'Second &amp; third',
  'line two',
  '',
  '00:00:07.000 --> 00:00:08.000',
  '<c.yellow></c>',
  '',
].join('\r\n') // 故意用 CRLF

test('toSeconds 吃 HH:MM:SS.mmm 與 MM:SS.mmm', () => {
  assert.equal(toSeconds('00:00:12.480'), 12.48)
  assert.equal(toSeconds('01:02:03.500'), 3723.5)
  assert.equal(toSeconds('02:03.500'), 123.5)
  assert.ok(Number.isNaN(toSeconds('abc')))
})

test('cleanText 去標記、還原實體、先去標記再還原', () => {
  assert.equal(cleanText('Hi <i>you</i> &amp; me'), 'Hi you & me')
  assert.equal(cleanText('a &lt;i&gt; b'), 'a <i> b') // 字幕裡寫的 &lt;i&gt; 不能被當成標記吃掉
  assert.equal(cleanText('  x  \n\n  y  '), 'x\ny')
})

test('parseVtt：略過標頭與 NOTE、處理 CRLF、丟掉空內容、依 start 排序', () => {
  const cues = parseVtt(SAMPLE)
  assert.equal(cues.length, 2) // 第三筆清掉標記後是空的 → 丟掉
  assert.deepEqual(cues[0], { start: 1, end: 3, text: 'Hello there' })
  assert.deepEqual(cues[1], { start: 2.5, end: 5, text: 'Second & third\nline two' })
})

test('parseVtt：亂序輸入會被排好', () => {
  const cues = parseVtt('WEBVTT\n\n00:00:09.000 --> 00:00:10.000\nb\n\n00:00:01.000 --> 00:00:02.000\na\n')
  assert.deepEqual(cues.map((c) => c.text), ['a', 'b'])
})

test('activeAt：邊界與重疊', () => {
  const cues = parseVtt(SAMPLE)
  assert.deepEqual(activeAt(cues, 0.5), []) //                    還沒開始
  assert.deepEqual(activeAt(cues, 1).map((c) => c.text), ['Hello there']) // 起點含
  assert.equal(activeAt(cues, 2.7).length, 2) //                  兩句重疊
  assert.deepEqual(activeAt(cues, 3).map((c) => c.text), ['Second & third\nline two']) // 終點不含
  assert.deepEqual(activeAt(cues, 6), []) //                      空窗
  assert.deepEqual(activeAt([], 1), [])
})

test('mergeCues：各段字幕接起來並依開始時間排序（時間碼本來就是整集絕對時間，不平移）', () => {
  const p1 = [{ start: 4, end: 6, text: 'a' }, { start: 700, end: 705, text: 'b' }]
  const p3 = [{ start: 1160, end: 1162, text: 'd' }]
  const p2 = [{ start: 731, end: 733, text: 'c' }]
  assert.deepEqual(mergeCues([p1, p3, p2]).map((c) => c.start), [4, 700, 731, 1160])
  assert.deepEqual(mergeCues([]), [])
})
