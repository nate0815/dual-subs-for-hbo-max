/* 產生可分享的竄改猴腳本：把 manifest.json 列的檔案依序串成單一 dist/hds.user.js。
 *
 * 用法：node scripts/build-userscript.mjs     （或 npm run build）
 *
 * 為什麼有這支：分享給別人時，對方要能「點連結安裝、自動更新」，
 * 那必須是單一檔案、放在公開網址（GitHub Releases）。開發時仍用 dev/hds.user.js 直接讀原始檔，
 * **開發不需要跑這支**。
 *
 * 這不是打包工具：不轉譯、不壓縮、沒有相依套件，只是照順序把檔案接起來。
 * 每個原始檔本來就是自包含的立即執行函式，接起來就能跑。
 *
 * ⚠️ 載入順序只從 manifest.json 讀，不在這裡另寫一份（TECH「不變式」第 1 條）。
 * ⚠️ @version 取自 manifest.json —— 竄改猴靠它判斷有沒有新版，沒 bump 就不會更新（TECH「不變式」）。
 * 產出物在 dist/，已 gitignore，不進版控；發佈流程見 AGENTS.md「tag」。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 發佈位置：最新一版 Release 的附件。竄改猴用它檢查與下載更新。 */
export const RELEASE_URL = 'https://github.com/nate0815/HboDualSub/releases/latest/download/hds.user.js'

/** 純函式：manifest 物件 ＋ 讀檔函式 → userscript 全文。測試直接呼叫這支。 */
export function buildUserscript(manifest, readFile) {
  const cs = manifest.content_scripts[0]
  const header = [
    '// ==UserScript==',
    `// @name         ${manifest.name}`,
    '// @namespace    https://github.com/nate0815/HboDualSub',
    `// @version      ${manifest.version}`,
    `// @description  ${manifest.description}`,
    ...cs.matches.map((m) => `// @match        ${m}`),
    '// @run-at       document-start',
    '// @grant        none', // 跑在頁面本身的環境，等同 manifest 的 world: "MAIN"
    `// @updateURL    ${RELEASE_URL}`,
    `// @downloadURL  ${RELEASE_URL}`,
    '// ==/UserScript==',
    '',
    '// 由 scripts/build-userscript.mjs 產生，請勿手改。原始碼：https://github.com/nate0815/HboDualSub',
    '',
  ]
  const body = cs.js.map((file) => `// ---- ${file} ----\n${readFile(file).trimEnd()}\n`)
  return header.join('\n') + '\n' + body.join('\n')
}

// 直接執行時才寫檔；被測試 import 時不動作
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
  const out = buildUserscript(manifest, (f) => readFileSync(join(root, f), 'utf8'))
  mkdirSync(join(root, 'dist'), { recursive: true })
  writeFileSync(join(root, 'dist', 'hds.user.js'), out)
  console.log(`dist/hds.user.js（v${manifest.version}，${manifest.content_scripts[0].js.length} 個檔）`)
}
