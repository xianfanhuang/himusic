/* ytdl-plugin.js
 * 通用嗅探器：复用 youtube-dl-js（前端版）
 * 把页面 URL 变成直链 {name, url}
 */

const CDN = 'https://cdn.jsdelivr.net/npm/youtube-dl-js@latest/dist/ytdl.min.js';

// 动态加载脚本
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// 暴露给外部：一键解析
export async function parseWithYtdl(pageUrl) {
  if (!window.ytdl) await loadScript(CDN);
  try {
    const info = await ytdl.getInfo(pageUrl);
    const fmt  = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    if (!fmt) throw new Error('无音频流');
    return [{ name: info.title || '未知', url: fmt.url }];
  } catch (e) {
    alert('解析失败：' + e.message);
    return null;
  }
}
/*2. 启用步骤（仅 3 处 +1 行）
表格

复制
文件	改动
index.html	在 <script src="app.js"></script> 之前 加一行：
app.js	顶部加一行：
app.js	把 parsePage() 函数体替换为 1 行：
示例（app.js 只需改函数体）：
JavaScript

复制
// 原来 100 行的 parsePage() 直接改成 ↓
async function parsePage(pageUrl) {
  return parseWithYtdl(pageUrl);
}
────────────────────────────
3. 一键回退
不想用插件时，把 app.js 里 parsePage() 恢复成旧实现即可；
或者注释掉 import {parseWithYtdl} 与 <script> 标签即可禁用。*/