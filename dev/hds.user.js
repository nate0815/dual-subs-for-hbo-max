// ==UserScript==
// @name         HboDualSub (dev)
// @namespace    hbo-dual-subs-dev
// @version      0.0.0
// @description  開發用：直接讀本機原始碼。改完存檔 → 重新整理 HBO 頁面即生效。
// @match        https://www.hbomax.com/*
// @run-at       document-start
// @grant        none
// @require      file:///D:/2026_Practice/HboDualSub/src/lib/vtt.js
// @require      file:///D:/2026_Practice/HboDualSub/src/lib/mpd.js
// @require      file:///D:/2026_Practice/HboDualSub/src/lib/overlay.js
// @require      file:///D:/2026_Practice/HboDualSub/src/lib/langmenu.js
// @require      file:///D:/2026_Practice/HboDualSub/src/main.js
// ==/UserScript==

/* 這支只是轉接，本體全在 @require 的五個檔。
 *
 * 安裝：竄改猴 → 新增腳本 → 貼上本檔全文 → 存檔。
 * 前提：chrome://extensions → 竄改猴「詳細資料」→ 開啟「允許存取檔案網址」，
 *       否則讀不到 file:///，畫面不會有任何錯誤提示，只是沒有字幕。
 * 路徑：專案搬了位置就改上面的 @require 路徑。
 *
 * ⚠️ @require 的順序必須與 manifest.json 的 js 陣列一致（TECH「不變式」第 1 條）。
 * ⚠️ 與「載入未封裝項目」的擴充功能**二選一**，同時開會出現兩層字幕。
 * ⚠️ 這是開發用；驗收仍要用載入未封裝項目跑一次（注入時機不同）。
 *    理由見 doc/decisions/2026-11-11-開發時用竄改猴載入驗收仍用未封裝.md
 */
