# 雙字幕 for HBO Max（dual-subs-for-hbo-max）— 給 AI 的工作守則

這份只放指標。規則本體在各自的正本裡，**不要在這裡複製一份**。

> 這份是**工具中立的正本**。Claude Code 讀的 [CLAUDE.md](CLAUDE.md) 只是一行 `@AGENTS.md`
> 匯入加幾句專屬補充；Codex CLI 直接讀這一份。**要改守則就改這裡。**

## 1. doc/DESIGN.md 是唯一參照原則

動程式**之前**先確認它怎麼寫。發現實作或需求與它牴觸：**停下來問 Nate**，
列出「規格怎麼寫／實作怎樣／出處」，由 Nate 裁決。

**不得自行改寫 DESIGN 來遷就實作。** 完整條款見 [doc/DESIGN.md](doc/DESIGN.md) 開頭。

DESIGN.md 的寫入受機制保護，**兩種工具的行為刻意不同**：

| 工具 | 你會遇到什麼 | 人要怎麼放行 |
|---|---|---|
| Claude Code | 跳確認框（`permissions.ask`） | 當場點頭即可 |
| Codex CLI | **直接擋下**（PreToolUse hook）—— Codex 不支援「跳框問人」 | 建 `doc/.design-unlock`（空檔即可），改完刪掉 |

`doc/.design-unlock` 是 gitignore 的 —— 它是一次性的「人點頭」手勢，不是設定。
**看到它存在不代表你獲得授權改任何東西**，只代表這一次的 DESIGN 修改已經過人同意。

⛔ **那個檔要由人建立，你不可以自己建**（hook 會擋）—— 自己建等於自己授權自己。
想改規格正本就停下來升報，把「規格怎麼寫／實作變成怎樣／出處」給人看。

## 2. 動到程式或規格，收工前要回填文件

用 doc-sync skill（Claude Code：`/doc-sync`；Codex：說「回填文件」喚起）。

**收工檢查會擋** —— `doc/devlog/`、`doc/decisions/`、`doc/gotchas/` 與
[doc/DEVLOG.md](doc/DEVLOG.md) **全都沒動**就結束不了。兩種工具跑的是
同一支腳本（`.agents/hooks/doc-sync-check.mjs`），擋下的理由文字一字不差。

落點與 frontmatter 規格見 [doc/DEVLOG.md](doc/DEVLOG.md) §0。

四份正本在 `doc/`，分工與維護方式見 [doc/DEVLOG.md](doc/DEVLOG.md) §0。

根目錄的 `README.md` 是**對外的進站點**，不是第五份正本 ——
檔案結構／上手方式／驗證指令變了要同步它，但**深度內容留在 `doc/`，README 只放指標**。
它還沒建、或缺了必備章節，照
[.agents/skills/doc-sync/SKILL.md](.agents/skills/doc-sync/SKILL.md) 的「README 的必備章節」補。

**三條讓回填不痛的規矩**（本體在 [.agents/skills/doc-sync/SKILL.md](.agents/skills/doc-sync/SKILL.md)）：

1. **commit 當下就寫 `決策：X／因為 Y`** —— 回填的「為什麼」從 commit body 抄，
   不是兩天後從 diff 反推。反推貴 5～10 倍，而且常常推不出來。
2. **程式碼的回填先進 [doc/TECH.md](doc/TECH.md) 的收件匣章節**（最末節），
   不必當下決定歸到哪一節。**例外：新的不變式直接寫不變式那一節**，不能延後。
3. **新寫的跨檔引用寫章節標題，不寫章號**（`TECH「不變式」`，不是 `TECH §16.7`）——
   章號位移不會有任何工具報錯。既有的不回頭改。

## 3. 改程式前先讀不變式

[doc/TECH.md](doc/TECH.md)「不變式」一節。
列的都是**破壞後不一定馬上看得出來**的約束。

## 4. 這個專案的性質

Chrome 擴充功能（Manifest V3）：在 HBO Max 播放頁同時顯示兩條**官方**字幕（預設英文 CC 在上、繁中在下），公開在 GitHub 分享。
**開發**沒有 build step、沒有框架、沒有 npm 相依 —— 純 JavaScript，用 `node --test` 跑單元測試。價值在改得快、竄改猴或載入未封裝項目就能試。
唯一的「建置」是**發佈**竄改猴版時，`scripts/build-userscript.mjs` 照 manifest 順序把原始檔串成一個檔 —— 零相依、不轉譯，開發時不需要跑。
不要為了「比較正規」引入打包工具、TypeScript 或框架，也不要把那支串接腳本長成打包工具。

**三條不要碰的線**：

1. 只讀字幕**文字**，不碰影片串流，更不嘗試繞過 DRM。
2. 字幕內容只在記憶體裡處理，**不存檔、不寫進文件或測試**（見 §6.2）。
3. 字幕要的是**官方**那兩條軌，不要改成機器翻譯補第二行 —— 那正是自己做這個東西的理由（見 [doc/PLAN.md](doc/PLAN.md)「為什麼不用現成擴充功能」）。

## 5. 文件的物理形態

**Obsidian 是可選的閱讀器，不是這套體系的地基。** 沒有它，`doc/` 用 git ＋ grep
一樣完整運作 —— 所以不要寫出「只有在 Obsidian 裡才成立」的東西。

| 規矩 | 說明 |
|---|---|
| **跨檔引用寫相對路徑 Markdown 連結** | `[某決策](decisions/2026-08-26-xxx.md)`。**不要用 `[[wikilink]]`** —— 它不帶路徑，你只能用檔名去猜是哪一個，vault 裡一有同名檔就歧義，而且 GitHub 與編輯器都點不開 |
| **指向章節時寫標題，不寫章號** | `TECH「不變式」` 而非 `TECH §5`。章號會因為前面插一節就整批位移，而**沒有任何工具會報錯** |
| **專有名詞與程式碼一字不差** | 文件寫 `PlayerController` 就不要在別處寫「玩家控制器」。命名不一致會大幅降低搜尋命中率 |
| **標題結構要能當定位錨點** | 階層明確的 `##` / `###`。`grep -n '^## '` 是最常用的定位方式 |
| **Dataview／Bases 的產出不是正本** | 那是 render 時才算出來的，檔案裡只有查詢語句。你讀到的是**零筆資料，而且不會報錯** —— frontmatter 才是正本 |

> **一條判準管住全部**：關掉 Obsidian、用記事本打開那個檔，
> **看不到的東西，你也看不到。**

## 6. 分支與發佈

> 這一節是從 doc-system-kit 的範本裁剪來的：這個專案是單人開發、以 tag ＋ GitHub Release 發佈的擴充功能，
> **凍結的可用版本由 tag 承擔**，所以沒有 `stable`、`hotfix/*`、`demo/*`。
> 之後真的需要（例如多人協作、要同時維護舊版）再補，理由見
> [doc/decisions/2026-11-11-分支模型先不設stable與demo.md](doc/decisions/2026-11-11-分支模型先不設stable與demo.md)。
> **沒有的線就是沒有的** —— 不要照範本把它們加回來。

人的操作步驟不在這裡，本檔只放你要遵守的規則。

### 6.1 分支表

| 分支 | 角色 | 從哪開 | 合回哪 | 壽命 |
|---|---|---|---|---|
| `main` | **主要開發分支**，整合點。保持隨時可以「載入未封裝項目」就跑 | —— | —— | 永久 |
| `feat/<slug>` | 新功能 | `main` | → `main` | 短命，合併後刪 |
| `fix/<slug>` | 修 bug | `main` | → `main` | 短命，合併後刪 |
| `docs/<slug>` `chore/<slug>` `refactor/<slug>` | 其餘雜項 | `main` | → `main` | 短命 |

**命名**：`<type>/<英文-kebab-slug>`。type 與 commit message 的 type
**共用同一套字彙**（`feat` `fix` `docs` `chore` `refactor`），一套字彙管兩個地方。

⛔ **不要在 `main` 上直接開工。** 要動手就先開分支 —— 包含只改一行的情況。

### 6.2 護欄

| 護欄 | 違反的話會怎樣 |
|---|---|
| ⭐ **不要 commit 字幕內容** —— 抓下來的 `.vtt`、貼進文件或測試的真實台詞，都不進版控。測試用的字幕一律自己編 | 字幕是內容方的著作。進了 git，事後刪檔歷史裡仍然留著，要移除得改寫歷史 |
| **build 產出物不進 git** | 這個專案目前沒有 build；日後若加了打包，產出物不進版控（`.gitignore` 已排除常見目錄） |

### 6.3 tag

正式版 `v<major>.<minor>.<patch>`，例 `v0.1.0`，打在 `main`。
打 tag 時 `manifest.json` 的 `version` 要一起改成同一個號。

**每個 tag 都要發一個 GitHub Release，附上竄改猴腳本**（使用者的自動更新靠它）：

```bash
npm test && npm run build              # 產出 dist/hds.user.js，@version 取自 manifest
gh release create v0.1.0 dist/hds.user.js --title v0.1.0 --notes "<這版改了什麼>"
```

⚠️ 附件檔名必須是 `hds.user.js`（腳本裡的更新網址寫死 `releases/latest/download/hds.user.js`）。
⚠️ 沒 bump `manifest.json` 的 `version` 就發佈，竄改猴會判斷「沒有新版」而**不更新，也不報錯**。

> ⚠️ [doc/DESIGN.md](doc/DESIGN.md) 版本紀錄裡的 `v0.1` 是**文件內部版本**，
> 跟 git tag（與 `manifest.json` 的 `version`）**是兩套編號**。兩者不對齊，也不該對齊 ——
> 不要為了讓它們看起來一致而去改任何一邊。

### 6.4 哪個時機要動文件

| 時機 | 文件動作 |
|---|---|
| 開 `feat/*` | **無**。不要為了開分支先寫文件 |
| 合回 `main` | 照舊收工回填（收工檢查會擋） |
| 打 tag | 規格有動才 bump DESIGN／PLAN 版本紀錄 ＋ `doc/devlog/` 記一則，**寫上 tag 名**；順便照 `README.md` 的「怎麼跑起來」實跑一次 —— 那段最容易在不知不覺間失真 |
