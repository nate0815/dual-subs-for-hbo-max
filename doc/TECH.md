# 雙字幕 for HBO Max（dual-subs-for-hbo-max）— 技術實作參考（TECH）

> **定位**：**實際怎麼實作的** 的正本。**要改程式就看這份。**
> 跟著程式改 —— 程式動了、這份沒動，就是欠回填。
>
> | 文件 | 職責 | 維護方式 |
> |---|---|---|
> | [DESIGN.md](DESIGN.md) | **做什麼** | 現在式；**⭐ 唯一參照，改動需授權** |
> | [PLAN.md](PLAN.md) | **怎麼做（方向）** | 現在式，就地改成最新版 |
> | **TECH.md**（本檔） | **實際怎麼實作的** — 資料契約、模組介面、不變式、驗證方式 | 現在式，跟著程式改 |
> | [DEVLOG.md](DEVLOG.md) | **發生了什麼** | 過去式，只追加 |
>
> 與 DESIGN 牴觸時**以 DESIGN 為準**：如果是本檔寫錯，直接改本檔；
> **如果是程式偏離了規格，停下來回報，不要改 DESIGN 去遷就它。**

---

## 0. 檔案清單

| 檔案 | 職責 | 行數 |
|---|---|---|
| `manifest.json` | 擴充功能宣告：內容腳本、載入順序、主世界 | 20 |
| `src/lib/vtt.js` | 解析 WebVTT；查某時刻顯示中的句子（純函式） | 88 |
| `src/lib/mpd.js` | 從 DASH 清單檔列出文字軌、依語言挑軌（純函式） | 79 |
| `src/lib/overlay.js` | 建立並定位疊加層、設定兩行文字 | 86 |
| `src/main.js` | 觀察清單檔、抓字幕、計時更新、快捷鍵、設定 | 156 |
| `test/vtt.test.js` | `vtt.js` 的單元測試（假資料） | 57 |
| `test/mpd.test.js` | `mpd.js` 的單元測試（假資料，結構仿實測） | 65 |

---

## 1. 30 秒驗證 ⭐

> 這是「確認它還沒壞」。第一次怎麼載入擴充功能，看根目錄 [README.md](../README.md)。

```bash
node --test
```

看到 `# fail 0` 就是解析邏輯與選單的純函式正常。**這不證明畫面上看得到字幕** —— 那一步要在 HBO Max 播放頁用眼睛確認（主控台會印 `[HDS] 字幕軌…`）。

---

## 2. 執行流程（啟動順序）

1. Chrome 在頁面載入最早期（`document_start`）依 `manifest.json` 的順序注入五個檔，全在頁面的**主世界**。`vtt.js` → `mpd.js` → `overlay.js` → `langmenu.js` 各自把介面掛到 `window.__HDS__`，`main.js` 最後從那裡解構。
2. `main.js` 用 `PerformanceObserver`（`resource`，含已發生的）找網址是 `.mpd` 的請求，找到就 `load(url)`。
3. `load`：抓清單檔 → `parseTextTracks` → `loadCues`：`resolveTrack` 依設定挑上排與下排 → 各抓一份 `.vtt`（有快取就不抓）→ `parseVtt`，存進 `state`。換集會有新的清單檔請求，**後發的呼叫會讓先發還沒回來的結果作廢**（見不變式）。在語言選單改選時，`onSelect` 存設定後也走 `loadCues`。
4. `setInterval(tick, 100)`：不在 `/video/watch/` 或沒有 `<video>` 就全部隱藏；否則先 `menu.update`（確保語言按鈕在控制列上），再讀 `video.currentTime` → `activeAt` → 更新疊加層（關閉或沒有字幕時只隱藏疊加層，按鈕仍在）。
5. `keydown` 監聽處理快捷鍵，改設定後寫回 `localStorage`。

---

## 3. 核心資料契約 ⭐

**文字軌**（`parseTextTracks` 的輸出，一軌一個物件）：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | 清單檔內 `Representation` 的 id |
| `lang` | string | 例 `en-US`、`zh-Hant-TW` |
| `role` | string | 例 `caption`、`subtitle`；沒有則為空字串 |
| `segments` | number | **同一 Period 內**的分段數（`<S>` 數）；每段只讀第一個 |
| `urls` | string[] | 這條軌在**每個 Period** 的字幕檔網址，依 Period 順序；只有一段時長度 1。同一 Period 內語言＋角色相同的第 n 條，與其他 Period 的第 n 條合併 |
| `url` | string | 等於 `urls[0]`。**已解析成絕對網址**，`&amp;` 已還原，`$Number$` 已代入 `startNumber` |

**句子**（`parseVtt` 的輸出，依開始時間遞增）：`{ start: number, end: number, text: string }`，單位秒；`text` 已去掉標籤與實體，可含換行。

**設定**（`localStorage['hds:settings']`，JSON）：`{ enabled, top, bottom, fontScale, offsetMs }`。缺的欄位用預設值補，壞掉的 JSON 退回預設。`top`／`bottom` 是預設前綴陣列時**不存**、載入時也丟掉（舊版存過的），讓預設改了能對所有人生效。

---

## 4. 模組契約 ⭐

### 4.1 `vtt.js`

| 對外介面 | 作用 |
|---|---|
| `toSeconds(str)` | `HH:MM:SS.mmm` 或 `MM:SS.mmm` 轉秒 |
| `cleanText(raw)` | 去標籤、還原實體、整理空白 |
| `parseVtt(text)` | 全文轉句子陣列 |
| `activeAt(cues, t)` | 回傳時刻 `t` 正在顯示的所有句子 |

**誰能呼叫**：任何人，包含 Node 測試。
**不能做什麼**：不碰 `window`／`document`／網路；不寫入任何儲存。

### 4.2 `mpd.js`

| 對外介面 | 作用 |
|---|---|
| `isMpdUrl(url)` | 網址是不是清單檔 |
| `parseTextTracks(xml, baseUrl)` | 清單檔全文轉文字軌陣列 |
| `pickTrack(tracks, langPrefixes)` | 依語言前綴的優先順序挑一軌，不分大小寫 |

**誰能呼叫**：任何人。
**不能做什麼**：不碰網路與 DOM；**結構認不得時回傳 `[]`，不准拋例外**（呼叫端靠空陣列判斷「沒有字幕」）。

### 4.3 `overlay.js`

| 對外介面 | 作用 |
|---|---|
| `createOverlay()` | 回傳 `{ el, setText, place, show, remove }` |
| `setText(top, bottom)` | 設兩行文字；空字串的那一排整個隱藏 |
| `place(video, host, fontScale)` | 對齊影片外框、掛到 `host`、算字級 |

**誰能呼叫**：只有 `main.js`。
**不能做什麼**：不抓字幕、不讀設定、不監聽鍵盤；**不能接收滑鼠事件**（見不變式）。

### 4.4 `main.js`

沒有對外介面。除錯用：`window.__HDS__.state`（目前狀態）、`window.__HDS__.reload()`（用已知清單檔網址重抓）。

**不能做什麼**：不把字幕內容寫進 `localStorage`、不寫檔、不印進主控台（只印軌的語言與句數）。

---

## 5. 不變式 ⭐⭐ 破壞這些會壞掉，而且不一定馬上看得出來

| # | 不變式 | 保護哪個檔／符號 | 破壞後的症狀 |
|---|---|---|---|
| 1 | `manifest.json` 的 `js` 順序必須是 `vtt` → `mpd` → `overlay` → `langmenu` → `main`，且 `dev/hds.user.js` 的 `@require` 順序**與它一致**（發佈用的 `scripts/build-userscript.mjs` 直接讀 manifest，不必另外對） | `manifest.json` `content_scripts[0].js`、`dev/hds.user.js` | `main.js` 解構到 `undefined`，整個腳本靜默失效，頁面看起來一切正常，只是沒有字幕。只改一邊的話，另一種載入方式壞掉，而開發時不會發現 |
| 2 | 內容腳本必須在主世界（`"world": "MAIN"`） | `manifest.json` | 預設的隔離世界看不到頁面的資源請求時序，也可能行為不同；**目前只在主世界驗證過**，改了要重新驗 |
| 3 | 字幕網址取自清單檔的 `SegmentTemplate`，查詢字串**原樣保留** | `src/lib/mpd.js` `parseTextTracks` | 少了查詢參數會 403 或抓到別的內容，而且錯誤只出現在 `fetch`，不會指向這裡 |
| 4 | 清單檔裡的 `&amp;` 必須還原成 `&` 之後才能當網址用 | `src/lib/mpd.js` `parseTextTracks` | 網址看起來差不多但請求失敗；測試不涵蓋就看不出來 |
| 5 | 剝標籤要在還原實體**之前** | `src/lib/vtt.js` `cleanText` | 字幕內容若含 `&lt;i&gt;` 之類，先還原再剝會把它當標籤吃掉，字幕少一段字 |
| 6 | 疊加層必須 `pointer-events: none` | `src/lib/overlay.js` `createOverlay` | 蓋住播放器的點擊區，點影片沒反應、暫停／拖曳壞掉 |
| 7 | 全螢幕時疊加層要掛在 `document.fullscreenElement` 之下（它本身是 `<video>` 時除外，改掛 `body`） | `src/main.js` `tick` | 全螢幕時整個瀏覽器只渲染全螢幕元素的子樹，掛在 `body` 的疊加層**消失**，但一切程式都「正常運作」 |
| 8 | `load` 要用遞增的票號丟棄過期結果 | `src/main.js` `load` | 快速換集時，慢回來的上一集字幕蓋掉新一集，字幕對不上 |
| 9 | 字幕內容絕不持久化（不寫儲存、不寫檔、不印主控台、不進版控）。`state.cache` 只在記憶體、換集就清 | `src/main.js`、`test/` | 版權與帳號風險；也違反 [AGENTS.md](../AGENTS.md) 的紅線 |
| 10 | 找 HBO 控制列只用 `data-testid`（錨點 `player-ux-track-selector-button`），**不用 class** | `src/lib/langmenu.js` `ANCHOR`／`findAnchor` | class 是 styled-components 雜湊，同頁就有兩組、改版就變：按鈕會插到錯的那組或直接找不到，畫面上只看到「浮動按鈕跑出來」 |
| 11 | 語言按鈕、面板、快捷鍵提示（toast）都不可放進疊加層；按鈕與面板要吃掉滑鼠事件（`swallow`） | `src/lib/langmenu.js` `createLangMenu` | 放進疊加層 → 按鈕被 `pointer-events: none` 繼承，點不到；toast 跟著疊加層一起被隱藏，偏偏「雙字幕：關」正是疊加層隱藏時要看到的。不吃事件 → 點選單冒泡到 HBO 播放器，被當成點影片而暫停 |
| 12 | 發佈時 `manifest.json` 的 `version` 一定要 bump，且 Release 附件檔名一定是 `hds.user.js` | `manifest.json`、`scripts/build-userscript.mjs` `RELEASE_URL` | 竄改猴比對 `@version` 判斷有沒有新版：沒 bump → 使用者永遠停在舊版；檔名不對 → 更新網址 404。**兩者都不會有任何錯誤訊息** |
| 13 | 一條軌的字幕要讀**所有 Period** 的字幕檔（`track.urls`）並合併；各段時間碼是整集絕對時間，**不平移** | `src/lib/mpd.js` `parseTextTracks`、`src/main.js` `fetchCues`、`src/lib/vtt.js` `mergeCues` | 只讀第一段 → 分段的集數播到一半之後沒有字幕，**沒有任何錯誤**；平移 → 後段字幕整體錯位。見 [分段清單檔後半集沒有字幕](gotchas/2026-11-11-分段清單檔後半集沒有字幕.md) |

---

## 6. 怎麼加一個新的 語言組合

目前預設英（上）＋繁中（下）。換語言組合：

**使用者自己換**：播放器控制列的語言按鈕，選了就存成全域偏好，不必改程式。

**改「沒選過的人」看到的預設值**：

1. 先在 HBO Max 播放頁主控台執行 `__HDS__.state`，看 `tracks` 裡實際有哪些 `lang`。
2. 改 `src/main.js` 的 `DEFAULTS.top`／`DEFAULTS.bottom`（語言前綴陣列，依序嘗試）。
3. 已在選單選過語言的人，`localStorage['hds:settings']` 的值會蓋掉預設 —— 要看到新預設，到主控台 `localStorage.removeItem('hds:settings')` 再重新整理。
4. 若新語言的文字軌結構與已知不同，先在 `test/mpd.test.js` 補一份仿真的片段再改 `mpd.js`。

---

## 7. 數值一覽

| 參數 | 位置 | 影響什麼 |
|---|---|---|
| `TICK_MS`（100） | `src/main.js` | 字幕更新頻率；越小越跟手、越耗電 |
| `DEFAULTS`（語言、字級倍率、偏移） | `src/main.js` | 初始設定；使用者調整後以 `localStorage` 為準 |
| 字級倍率範圍 0.5～2、步進 0.1 | `src/main.js`（快捷鍵處理） | 快捷鍵能調到多大多小 |
| `FONT_TOP`（0.046）、`FONT_BOTTOM`（0.034） | `src/lib/overlay.js` | 字級：影片高度的比例。上排主字幕較大、下排副字幕較小 |
| `BOTTOM_PAD`（9%） | `src/lib/overlay.js` | 字幕離畫面下緣多遠，避開控制列 |
| 上排黃 `#ffe27a`、下排白 `#ffffff` | `src/lib/overlay.js` | 兩行字的顏色 |
| `LOOKBACK`（12） | `src/lib/vtt.js` | `activeAt` 往回看幾句，涵蓋重疊的句子 |

---

## 8. 驗證與回歸

- **自動**：`node --test`，涵蓋 `vtt.js` 與 `mpd.js`（假資料；`mpd` 的假資料結構仿實測）。
- **手動（無法自動化）**：載入擴充功能到 HBO Max 播放頁，原生字幕關閉，確認兩行字出現；全螢幕；換集。這些依賴 DRM 播放器與登入狀態，沒辦法在 CI 或無頭瀏覽器裡跑。
- **不穩定的項目**：HBO 的網頁結構與清單檔格式隨時可能變，所以「昨天能用今天不能用」不一定是我們的程式壞了 —— 先看主控台有沒有 `[HDS]` 訊息，再看 `__HDS__.state`。

> ⚠️ 這套驗證證明的是「**沒有壞掉**」，不是「好不好看」。字級與位置要用眼睛調。

---

## 9. 刻意沒做的事

| 沒做 | 為什麼 |
|---|---|
| 同一 Period 內的多分段（每段只讀第一個 `<S>`） | 實測整集只有一段；沒看過多分段的實例就不憑空設計。遇到會在主控台警告 |
| 自動隱藏原生字幕 | 要依賴 HBO 的頁面結構，改版就壞；先請使用者手動關 |
| 字幕下載、單字查詢、AI 翻譯 | 超出範圍，見 [DESIGN.md](DESIGN.md)「明確不驗證什麼」 |
| HBO Max 以外的平台 | 同上 |
| 打包工具、TypeScript | 規模太小，見 [PLAN.md](PLAN.md)「已排除的技術路線」 |
| 設定頁／彈出視窗 | 先驗證核心，快捷鍵夠用 |
| 兩軌逐句配對 | 做不到也不需要，見 [兩條字幕各自依時間顯示不配對](decisions/2026-11-11-兩條字幕各自依時間顯示不配對.md) |

---

## 10. 本輪變更收件匣 ⭐ 回填先進這裡

> **這一節是暫存區，不是正式章節。永遠放在本檔最後一節。**
>
> 回填程式碼變動時，**只寫這裡一個落點**，不必當下決定它該歸到
> §0 檔案清單／§3 資料契約／§4 模組契約／§7 數值／§8 驗證 的哪一節。
>
> **為什麼要有它**：那個「該歸到哪一節」的判斷是回填最貴的部分 ——
> 文件長到十幾節之後，光是定位就要把整份結構重新載進腦子，而且一次改動
> 常常要判斷五、六次，做錯了還要重來。把判斷延後到「這塊實作已經穩定」
> 的時候一次做，會準得多、也快得多。
>
> **放最後一節也是刻意的**：新增章節不會讓任何既有章號位移。

### 10.1 規矩

| 規則 | 說明 |
|---|---|
| **內容是現在式** | 收件匣寫的是**現在的實作**，與其他章節同等有效、同樣是正本。差別只在「還沒歸位」，不是「還沒生效」 |
| **一條一行，附落點提示** | 格式：`- （→ §4 模組契約）xxx`。想不出落點就寫 `（→ ?）`，整併時再決定 —— **不准為了填那個箭頭而卡住** |
| **整併時機** | 三者任一：收件匣超過 **10 條**／該塊實作穩定下來／要交付或發 PR 之前 |
| **整併＝搬，不是重寫** | 整段搬進目標章節，**不重新措辭**。搬完從收件匣刪掉 —— 這一節**不是**只追加的，它是本檔唯一可以清空的地方 |
| ⚠️ **不變式例外** | **新的不變式不進收件匣，直接寫 §5** —— 那一節是每次動程式前必讀的，晚一天歸位就可能被違反。這是唯一的例外，沒有商量餘地 |

### 10.2 目前收件匣

- （→ 檔案清單）`dev/hds.user.js`：竄改猴轉接腳本，開發用。`@require file:///` 依 manifest 順序讀四個原始檔，`@grant none`（等同主世界）、`@run-at document-start`。需開啟竄改猴的「允許存取檔案網址」。
- （→ 驗證與回歸）開發時用竄改猴：改完存檔 → 重新整理 HBO 頁面即生效，不必到 `chrome://extensions` 重新載入。**與未封裝擴充功能二選一**；注入可能比原生內容腳本晚，靠 `PerformanceObserver` 的 `buffered: true` 補回（資源紀錄緩衝區預設 250 筆），所以驗收仍要用未封裝跑一次。
- （→ 檔案清單）`src/lib/langmenu.js`：語言按鈕與選單面板（DOM），另含純函式 `langName`／`trackLabel`。`test/langmenu.test.js` 測那兩個純函式。
- （→ 核心資料契約）設定的 `top`／`bottom` 有三種形狀：語言前綴陣列（預設，例 `['zh-hant','zh']`）、`{ lang, role }`（使用者在選單選的那條）、`null`（關閉）。解讀規則集中在 `resolveTrack`。
- （→ 模組契約）`mpd.js` 新增 `resolveTrack(tracks, pref)`：陣列交給 `pickTrack`；`{lang, role}` 要語言完全相同（不分大小寫），優先同角色、否則同語言第一條；語言不同一律 `null`（DESIGN：不自動改用別的語言）。
- （→ 模組契約）`langmenu.js`：`createLangMenu({ getView, onSelect })` 回傳 `{ button, panel, update(video, host), hide() }`。`getView()` 回 `{ status, tracks, top, bottom }`（`status`：`idle|loading|ready|error`；`top`／`bottom` 是目前挑中的軌物件或 `null`）。**誰能呼叫**：只有 `main.js`。**不能做什麼**：不抓字幕、不存設定（選了什麼交給 `onSelect`）。
- （→ 模組契約）`main.js` 新增 `loadCues(ticket)`、`onSelect(row, track)`；`state` 新增 `status`、`topTrack`、`bottomTrack`、`cache`（軌網址 → 句子陣列）、`menu`。除錯時 `__HDS__.state.topTrack` 可看目前挑中哪條。
- （→ 數值一覽）`FLOAT_AFTER_MS`（1500）：控制列消失多久才改用浮動按鈕；`FLOAT_IDLE_MS`（3000）：浮動按鈕在滑鼠停止多久後隱藏。都在 `src/lib/langmenu.js`，假值。
- （→ 模組契約）`langmenu.js` 新增純函式 `formatOffset(offsetMs)`（快捷鍵提示文字，正值＝提早），與實例方法 `flash(text)`（影片上方中央顯示 `TOAST_MS` 後消失）。`getView()` 多回傳 `enabled`：關閉時按鈕 `opacity` 0.45、面板頂端顯示提示；面板底部固定列出 `HOTKEYS`。
- （→ 數值一覽）`TOAST_MS`（1500）：快捷鍵提示顯示多久，`src/lib/langmenu.js`。
- （→ 數值一覽）底部留白三個比例都在 `src/lib/overlay.js`：`PAD_LOW`（0.04，控制列收起）、`PAD_GAP`（0.015，控制列出現時與其上緣的間距）、`PAD_FALLBACK`（0.09，偵測不到控制列）。一律依影片高度換算 px —— CSS 的 padding 百分比相對**寬度**，見 [字幕比規格高一倍](gotchas/2026-11-11-字幕比規格高一倍.md)。
- （→ 模組契約）`overlay.js` 新增純函式 `bottomPad(rect, ctl)`；`place(video, host, fontScale, ctl)` 多一個 `ctl`；`setText(top, bottom, topOn, bottomOn)`：`on` 為真時即使沒字也保留一行（`visibility: hidden` ＋不換行空白），為假時整排 `display: none`。
- （→ 模組契約）`langmenu.js` 新增 `findControls()` → `{ top, visible }` 或 `null`（從沒看過控制列）。看過之後找不到一律當「收起」，因為 HBO 收起控制列可能是淡出也可能整個拔掉。`main.js` 每個 tick 把它傳給 `place`。
- （→ 檔案清單）`scripts/build-userscript.mjs`：發佈用，照 `manifest.json` 的 `content_scripts[0].js` 順序串成 `dist/hds.user.js`（gitignore）；`@version`／`@match` 取自 manifest，`@updateURL`／`@downloadURL` 指向 `releases/latest/download/hds.user.js`。匯出純函式 `buildUserscript(manifest, readFile)`，`test/build.test.mjs` 測順序、版本、語法。開發不用跑。
- （→ 驗證與回歸）發佈前：`npm test && npm run build`；發佈後用一個沒裝開發版的 Chrome 設定檔，從 Release 連結安裝實測一次。步驟見 AGENTS「tag」。
- （→ 驗證與回歸）`test/startup.test.js`：在 `node:vm` 的假瀏覽器環境裡照 manifest 順序實際執行全部內容腳本，確認不拋例外、`__HDS__` 介面齊全、觀察器／計時器／快捷鍵都有掛上；另有一項故意打亂順序、確認會失敗。守的是「不變式」第 1 條（順序錯了在瀏覽器裡是靜默沒字幕）。**不驗證畫面**。
- （→ 模組契約）`langmenu.js` 的 `Esc` 監聽在**捕獲階段**（`addEventListener(..., true)`），選單開著時 `stopPropagation`：播放中 HBO 播放器會先吃掉 `Esc`，冒泡階段收不到；不攔的話全螢幕下按 `Esc` 會連全螢幕一起退出。
- （→ 驗證與回歸）實機驗收可由 Claude 透過 Claude in Chrome 做（2026-11-11 首次）：開分頁進播放頁 → `__HDS__.state` 看 `status`／軌／句數（**只讀數量，不讀字幕文字**）→ 截圖看顏色與位置 → 點選單、按快捷鍵、換集、全螢幕。「載入未封裝項目」與重新載入擴充功能在 `chrome://extensions`，只能由人操作。注意：頁面剛開時 `status` 可能還是 `idle` —— 播放器過幾秒才請求 `.mpd`，不是故障。
- （→ 模組契約）`langmenu.js` 新增 `drawerOpen()`：`[data-testid="player_drawer"]` 存在且看得見（自身與祖先無 `display:none`／`visibility:hidden`／透明度 < 0.05）。面板**平常就在 DOM 裡**（關閉時 `visibility:hidden` ＋ `opacity:0`），所以不能只看存在。找不到 → `false`。`main.js` 的 tick 在面板打開時隱藏疊加層。判斷可見的邏輯抽成 `isShown(el)`，`findControls` 共用。
- （→ ?）嵌入位置：按鈕插在字幕設定按鈕（💬）的**左邊**、尺寸複製該按鈕的 `offsetWidth/Height`。每個 tick 檢查，被 React 重繪掉就插回去。浮動按鈕貼在影片右下角（右 64px、下 120px）。
- （→ 模組契約）`langmenu.js` 新增 `dropDefaultScript(lang)`（未匯出）：`langName` 先拿掉「該語言本來就用這種文字」的文字標記再交給 `Intl.DisplayNames`，例 `ja-Jpan` → `ja`（否則顯示「日文（日文）」）。中文一律保留繁體／簡體；非預設文字（例 `sr-Latn`）保留；地區永遠保留。
- （→ 模組契約）`overlay.js` 兩排字幕元素設 `dir="auto"`：由右往左的語言（希伯來文、阿拉伯文）才排得對，見 [由右往左的字幕排版錯亂](gotchas/2026-11-11-由右往左的字幕排版錯亂.md)。
