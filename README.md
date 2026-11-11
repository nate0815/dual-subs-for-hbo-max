# HBO Max 雙字幕（HboDualSub）

## 這是什麼

自用的 Chrome 擴充功能：在 HBO Max（台灣版）播放頁，同時顯示**官方英文 CC**（上排、白色）與**官方繁體中文字幕**（下排、黃色），方便邊看動畫邊練英文。不做機器翻譯，不碰 DRM，只讀文字字幕。

## 怎麼跑起來

0. 取得原始碼：`git clone https://github.com/nate0815/HboDualSub.git`（沒有 build step、沒有相依套件，clone 下來就能載入）。
1. 開 Chrome → 網址列輸入 `chrome://extensions` → 右上角開啟「開發人員模式」。
2. 按「載入未封裝項目」→ 選這個資料夾（有 `manifest.json` 的那層）。
3. 打開 HBO Max 任一集的播放頁（網址含 `/video/watch/`），把播放器的字幕設為「**關閉**」。
4. 約 1～3 秒後畫面下方應出現兩行字。打開 DevTools 主控台，看到 `[HDS] 字幕軌：…` 就代表抓到了。

快捷鍵（`Alt`＋`Shift`＋）：`D` 開關、`↑`／`↓` 字級、`[`／`]` 字幕延後／提早 100 毫秒。

改程式後：回到 `chrome://extensions` 按該擴充功能的重新載入，再重新整理 HBO 頁面。
開發時想省掉這一步，可改用竄改猴載入 [dev/hds.user.js](dev/hds.user.js)（用法寫在檔頭；與未封裝擴充功能二選一）。

快速確認解析邏輯沒壞：`node --test`（需要 Node 18+）。

## 文件在哪

- 規格：[doc/DESIGN.md](doc/DESIGN.md)
- 技術選型與排除的路線：[doc/PLAN.md](doc/PLAN.md)
- 實作細節與不變式（動程式前必讀）：[doc/TECH.md](doc/TECH.md)
- 進度、決策、踩坑：[doc/DEVLOG.md](doc/DEVLOG.md)
- 給 AI 的守則：[AGENTS.md](AGENTS.md)

## 現在到哪了

v0.1：程式與單元測試完成；**尚未在真實全螢幕與換集情境驗證**，也只測過 Adventure Time 一集。待辦見 [DEVLOG](doc/DEVLOG.md)「待決問題」。
