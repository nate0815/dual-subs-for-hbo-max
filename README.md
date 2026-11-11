# 雙字幕 for HBO Max（非官方）

在 HBO Max 播放頁同時顯示兩條**官方**字幕，例如上排英文 CC、下排繁體中文，方便邊看邊練英文。非官方工具，與 HBO 無關。

*Shows two official HBO Max subtitle tracks at once (e.g. English CC + Traditional Chinese). Unofficial, not affiliated with HBO. English guide: [USAGE.en.md](USAGE.en.md).*

> ⚠️ 安裝前請先讀 [免責聲明](#免責聲明)。

## 這是什麼

- 兩行都是 **HBO 自己提供的官方字幕軌**，不做機器翻譯；這集沒有的語言就不顯示。
- 上排、下排各顯示哪種語言，可以從這集實際有的字幕軌裡自己選，選擇會套用到之後每一集。
- 只讀字幕文字，不碰影片串流與 DRM。
- 適用：桌機版 Chrome ＋ `www.hbomax.com`（目前在台灣版驗證過）。手機、電視 App 不支援。

## 安裝

兩種方法**擇一**，不要同時裝（畫面會出現兩組字幕）。

<!-- 與 USAGE.zh-TW.md／USAGE.en.md 的「安裝」同步修改 -->

### 方法 A：竄改猴（建議，會自動更新）

1. 在 Chrome 安裝 [Tampermonkey（竄改猴）](https://www.tampermonkey.net/)。
2. 到 `chrome://extensions`，打開竄改猴的「**詳細資料**」，開啟「**允許使用者指令碼**」（較新版 Chrome 才有這個開關；沒看到就略過）。
3. 點這個連結：<https://github.com/nate0815/dual-subs-for-hbo-max/releases/latest/download/hds.user.js>
4. 竄改猴會跳出安裝頁，按「**安裝**」。

之後有新版時，竄改猴會自動更新。

### 方法 B：載入未封裝項目

1. 下載這個 repo（`git clone`，或在 GitHub 頁面按 Code →「Download ZIP」後解壓縮）。
2. Chrome 網址列輸入 `chrome://extensions`，右上角開啟「**開發人員模式**」。
3. 按「**載入未封裝項目**」，選這個資料夾（有 `manifest.json` 的那一層）。
4. 更新時：重新下載或 `git pull`，再到 `chrome://extensions` 按本工具的重新載入。

## 使用

1. 打開 HBO Max，播放任一集。
2. **先把 HBO 自己的字幕關掉**：播放器右下角 💬 →「翻譯字幕」選「**關閉**」。不關的話兩邊的字幕會疊在一起。
3. 約 1～3 秒後，畫面下方出現兩行字：**上排黃色（主字幕，較大）、下排白色（副字幕，較小）**。
4. **換語言**：移動滑鼠讓控制列出現，點 💬 **左邊**的本工具按鈕（方框裡上黃下白兩條線），上排、下排各選一條字幕軌，或選「關閉」。
5. 控制列出現時，字幕會自動往上讓開；打開 HBO 的「集數」面板時，字幕會暫時隱藏。

**本工具自己的快捷鍵**（不是 HBO 的；語言選單最下方也列著，按下時畫面上方會短暫提示）：

| 按鍵 | 作用 |
|---|---|
| `Alt`＋`Shift`＋`D` | 開／關雙字幕 |
| `Alt`＋`Shift`＋`↑` / `↓` | 字放大／縮小 |
| `Alt`＋`Shift`＋`[` / `]` | 字幕延後／提早 0.1 秒 |

設定存在這台電腦的瀏覽器裡（`hbomax.com` 的網站資料），清除網站資料就會回到預設。出問題時見 [使用說明「出問題時」](USAGE.zh-TW.md#6-出問題時)。

## 免責聲明

- **非官方工具**：本專案是個人製作，與 HBO、Warner Bros. Discovery 及其關係企業**沒有任何關係**，未獲其授權或認可。「HBO」「HBO Max」是其權利人的商標，這裡只用來說明本工具適用於哪個服務。
- **只處理你本來就看得到的字幕**：本工具只在你用自己的有效訂閱帳號播放時，讀取 HBO 提供給該次播放的字幕文字，並只在你的瀏覽器記憶體裡顯示。**不下載、不儲存、不轉傳**字幕或影片，也**不繞過或干擾 DRM** 等任何保護機制。
- **不收集資料**：不收集、不傳送任何個人資料或使用紀錄；設定只存在你自己的瀏覽器裡。
- **服務條款風險自負**：使用瀏覽器擴充功能或使用者腳本存取串流網站，可能不符合該服務的使用條款。作者**沒有評估**過 HBO Max 的使用條款，也不提供法律意見。是否使用、以及可能的後果（包含帳號受影響），由使用者自行判斷與承擔。
- **按現狀提供，不提供任何保證**：本工具可能因 HBO 網站改版而隨時失效或顯示錯誤；作者不對使用本工具造成的任何損失負責。
- **權利人通知**：若你是相關權利人並對本專案有疑慮，請透過 GitHub Issues 聯絡，作者會盡快處理。

*Disclaimer (English): This is an unofficial personal project, not affiliated with, authorized or endorsed by HBO or Warner Bros. Discovery; "HBO" and "HBO Max" are trademarks of their owners and are used only to describe compatibility. It only reads the subtitle text HBO serves to your own subscribed playback and displays it in your browser's memory. It does not download, store or redistribute subtitles or video, and does not circumvent DRM. It collects no data. Using browser extensions or userscripts on streaming sites may conflict with their terms of service; the author has not evaluated HBO Max's terms and gives no legal advice — use at your own risk. Provided "as is", without warranty of any kind. Rights holders with concerns: please open a GitHub issue.*

## 怎麼跑起來（開發者）

1. `git clone https://github.com/nate0815/dual-subs-for-hbo-max.git`（開發不需要 build、沒有相依套件），用上面「方法 B」載入。
2. 打開 HBO Max 播放頁，主控台看到 `[HDS] 字幕軌：…` 就代表抓到了。
3. 改程式後：`chrome://extensions` 按重新載入，再重新整理 HBO 頁面。想省掉這一步，改用竄改猴載入 [dev/hds.user.js](dev/hds.user.js)（用法寫在檔頭；與未封裝擴充功能二選一）。
4. 確認解析邏輯沒壞：`npm test`（Node 18+）。
5. 發佈新版（產生竄改猴腳本並附到 GitHub Release）：見 [AGENTS.md](AGENTS.md)「tag」。

## 文件在哪

- **使用說明**（含疑難排解，中英文）：[USAGE.zh-TW.md](USAGE.zh-TW.md)／[USAGE.en.md](USAGE.en.md)
- 規格：[doc/DESIGN.md](doc/DESIGN.md)
- 技術選型與排除的路線：[doc/PLAN.md](doc/PLAN.md)
- 實作細節與不變式（動程式前必讀）：[doc/TECH.md](doc/TECH.md)
- 進度、決策、踩坑：[doc/DEVLOG.md](doc/DEVLOG.md)
- 給 AI 的守則：[AGENTS.md](AGENTS.md)

## 現在到哪了

v0.1.0 準備發佈。已在實機驗證（載入未封裝項目，Adventure Time）：兩行字幕、語言選單、快捷鍵、控制列讓位、選集面板隱藏、換集、全螢幕。Rick and Morty 能顯示兩行字幕，但它的集數分成多段，多分段支援已修正、**尚待實機驗證**。待辦見 [DEVLOG](doc/DEVLOG.md)「待決問題」。

## 授權

[MIT](LICENSE)：可以自由使用、修改、散布，請保留著作權聲明。授權只涵蓋本專案的程式碼與文件，**不涵蓋 HBO Max 的任何內容**（字幕、影片等仍屬其權利人）。
