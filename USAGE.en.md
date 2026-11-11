# Dual Subs for HBO Max (unofficial) — User Guide

[繁體中文](USAGE.zh-TW.md)

Shows two **official** subtitle tracks at the same time on the HBO Max (Taiwan) player page, for example English CC on top and Traditional Chinese below. There is no machine translation: both lines always come from subtitle tracks HBO itself provides. If an episode doesn't have a track, that line simply isn't shown.

> Works with desktop Chrome on `www.hbomax.com`. Mobile and TV apps are not supported.

---

## 1. Install

Use **one** of the two methods, not both (otherwise you'll see two sets of subtitles).

### Method A: Tampermonkey (recommended, updates automatically)

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome.
2. Open `chrome://extensions`, click **Details** on Tampermonkey, and turn on **Allow user scripts** (only newer Chrome versions have this switch; skip it if you don't see it).
3. Open this link: <https://github.com/nate0815/dual-subs-for-hbo-max/releases/latest/download/hds.user.js>
4. Tampermonkey shows an install page. Click **Install**.

When a new version is released, Tampermonkey updates it automatically (or click "Check for updates" in Tampermonkey's dashboard).

### Method B: Load unpacked

1. Get this folder (`git clone`, or on the GitHub page click Code → "Download ZIP" and unzip it).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. To update: download again or `git pull`, then click reload on this extension in `chrome://extensions`.

Neither method needs any permissions, and the tool collects or sends no data. Subtitles are processed only in your browser's memory.

## 2. Getting started

1. Open HBO Max and play any episode.
2. **Turn off HBO's own subtitles first**: in the player, click 💬 (bottom right) and set subtitles to **Off**.
   Otherwise HBO's subtitles will overlap with this tool's.
3. After 1–3 seconds, two lines appear near the bottom: **yellow on top, white below**.

## 3. Changing languages

1. Move the mouse so the player controls appear.
2. To the **left** of 💬 (bottom right) there is this tool's button: a box with two bars, yellow over white.
3. Click it to open two columns, **上排（黃）** (top, yellow) and **下排（白）** (bottom, white). Each lists every official subtitle track in this episode, plus 關閉 (Off).
4. Your choice applies immediately and is remembered **for every episode after this one**.
5. If an episode doesn't have the language you picked, that line stays hidden; the tool never switches to a different language on its own.

> If the controls can't be found (for example after an HBO redesign), the button appears as a round button floating at the bottom right of the video instead. It works the same way.

## 4. Keyboard shortcuts

These are **this tool's own shortcuts**, not HBO's. Each press briefly shows the current value at the top of the video; the list is also at the bottom of the language menu.

| Keys | Action |
|---|---|
| `Alt`+`Shift`+`D` | Turn dual subtitles on/off |
| `Alt`+`Shift`+`↑` / `↓` | Larger / smaller text |
| `Alt`+`Shift`+`[` / `]` | Subtitles 0.1 s later / earlier |

While dual subtitles are off, the language button is dimmed but still lets you change languages.

## 5. Where settings are stored

In this computer's Chrome (site data for `hbomax.com`). Clearing site data resets everything to the defaults: English on top, Traditional Chinese below, no size or timing adjustment.

## 6. Troubleshooting

| Symptom | Try this |
|---|---|
| No subtitles and no button | Make sure the URL contains `/video/watch/`; reload the page; check the extension is enabled in `chrome://extensions` |
| The button is there but the menu stays on 讀取中 (Loading) | Reload the page. If it persists, press F12 and look for console messages starting with `[HDS]` |
| The menu says 這集沒有字幕軌 (no subtitle tracks) | HBO provides no text subtitles for this episode, so there is nothing to show |
| Subtitles are slightly off from the picture | Adjust with `Alt`+`Shift`+`[` / `]` |
| Two layers of subtitles overlap | HBO's own subtitles are still on; see step 2 of "Getting started" |
| Two sets of dual subtitles appear | The tool is loaded twice (for example, the dev version via Tampermonkey as well); disable one of them |

---

> A personal project with no affiliation to HBO or Warner Bros. Discovery. It may stop working when HBO changes its site.
