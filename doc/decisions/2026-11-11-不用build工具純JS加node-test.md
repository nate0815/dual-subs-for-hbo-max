---
type: decision
date: 2026-11-11
status: 生效
supersedes:
affects: [全部原始碼]
code: [package.json, manifest.json]
---

# 不用 build 工具，純 JS ＋ node 內建測試

**選了什麼**
- 純 JavaScript，無依賴；解析邏輯寫成純函式（`vtt.js`、`mpd.js`），用 `node --test` 測；其餘靠手動在 Chrome 驗證。

**沒選什麼、為什麼不選**
- Vite／TypeScript：約 400 行不值得，每次修改多一道建置，而且使用者要在 VS Code 快速微調。
- 隔離世界內容腳本：只驗證過主世界。

**如果錯了會怎樣**
- 程式長到約 1500 行或要多人協作時，再引入型別與打包；屆時開新決策推翻本則。
