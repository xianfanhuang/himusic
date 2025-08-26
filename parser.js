// 前端通用网页音频嗅探器（B 站 / 网易云 / SoundCloud / YT 等）
// 依赖 cors-anywhere CDN 解决跨域，纯前端，无密钥

const cors = 'https://cors-anywhere.herokuapp.com/'; // 可换成自建

// 正则表：不同站点拿直链的小技巧
const RULES = [
  {
    host: /bilibili\.com|b23\.tv/,
    re: /"audio":\[{"id":\d+,"baseUrl":"([^"]+)"/
  },
  {
    host: /music\.163\.com/,
    re: /"mp3Url":"([^"]+)"/
  },
  {
    host: /soundcloud\.com/,
    re: /"transcodings".*?"url":"([^"]+)"/
  },
  {
    host: /youtube\.com|youtu\.be/,
    // 简易判断：前端只能拿到 HLS(m3u8)，交给 hls.js 播放
    re: /"hlsManifestUrl":"([^"]+)"/
  }
];

export async function parsePage(pageUrl) {
  try {
    const {host} = new URL(pageUrl);
    const rule = RULES.find(r => r.host.test(host));
    if (!rule) throw new Error('暂不支持该站点');

    const html = await (await fetch(cors + pageUrl)).text();
    let [, audioUrl] = html.match(rule.re) || [];

    if (!audioUrl) throw new Error('未找到音频地址');
    audioUrl = JSON.parse(`"${audioUrl}"`); // 去掉转义

    // SoundCloud 二次解析
    if (/soundcloud/.test(host)) {
      const json = await (await fetch(cors + audioUrl)).json();
      audioUrl = json.url;
    }

    // YouTube HLS 交给 hls.js
    if (/youtube/.test(host) && window.Hls) {
      return {type: 'hls', url: audioUrl};
    }
    return {type: 'mp3', url: audioUrl};
  } catch (e) {
    alert('解析失败：' + e.message);
    return null;
  }
}