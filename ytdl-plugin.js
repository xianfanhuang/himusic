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