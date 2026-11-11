---
type: decision
date: 2026-11-11
status: 生效
supersedes:
affects: [發佈流程, 整個專案]
code: [scripts/build-userscript.mjs, manifest.json]
---

# 公開 repo，以 GitHub Releases 發佈竄改猴腳本

**選了什麼**
- repo 改為公開。每個 tag 用 `scripts/build-userscript.mjs` 把原始檔照 manifest 順序串成單一 `hds.user.js`，附在 GitHub Release；使用者點連結用竄改猴安裝，之後靠 `@updateURL` 自動更新。
- 「載入未封裝項目」保留為第二種裝法。
- 延續 [不經商店分享](2026-11-11-不經商店分享.md)：仍不上商店。

**沒選什麼、為什麼不選**
- 私人 repo ＋ 邀請協作者：對方得 clone、自己跑串接腳本、手動重裝，沒有自動更新 —— GitHub 的私人 repo 檔案與 Release 附件都要登入，竄改猴拿不到。Nate 選擇公開以換取「點連結安裝、自動更新」。
- zip ＋ 載入未封裝：零程式，但要開開發人員模式，每次更新都手動。
- `.crx`：Chrome 不允許安裝商店外的 `.crx`。
- 把 `dist/hds.user.js` commit 進 repo 用 raw 網址更新：違反 AGENTS「build 產出物不進 git」；Releases 正是產出物該去的地方，也跟 tag 一一對應。
- 打包工具（Vite 等）：只需要「照順序接起來」，零相依的串接腳本就夠。

**如果錯了會怎樣**
- 公開 repo 的風險：任何人都找得到這個讀取 HBO Max 字幕的工具，服務條款**未評估**（DESIGN「待決事項」），內容方可能要求下架。Nate 已知悉。真的被要求時，把 repo 改回私人即可停止散布（已裝的人不再收到更新）。
- 忘了 bump `version` 或附件檔名不對，使用者會靜默停在舊版 —— 寫進 TECH「不變式」第 12 條與 AGENTS「tag」。
- [開發時用竄改猴載入驗收仍用未封裝](2026-11-11-開發時用竄改猴載入驗收仍用未封裝.md) 當初排除「竄改猴當正式形式」的理由是 repo 不公開，該條件已不成立；那則的開發流程部分仍然生效，所以不標推翻。
