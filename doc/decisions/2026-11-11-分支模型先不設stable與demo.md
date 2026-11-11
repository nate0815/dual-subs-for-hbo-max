---
type: decision
date: 2026-11-11
status: 生效
supersedes:
affects: [版控流程]
code: []
---

# 分支模型先不設 stable 與 demo

**選了什麼**
- 只用 `main`、`feat/*`、`fix/*`、`docs|chore|refactor/*`。版本用 `vX.Y.Z` 標籤打在 `main`，並與 `manifest.json` 的版本對齊。

**沒選什麼、為什麼不選**
- `stable`、`hotfix/*`、`demo/*`：starter 預設有，但這是單人自用、沒有交付對象，也不需要對外展示的凍結版本，多出來只會增加負擔。

**如果錯了會怎樣**
- 若日後要分享給別人或需要凍結可用版本，再補 `stable` 並開新決策。
