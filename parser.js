// parser.js – 支持网易云歌单 / 单曲 / 其它站点
const cors = 'https://cors-anywhere.herokuapp.com/';

/* 工具：从网易 track.id 拿直链 */
async function get163TrackUrl(id) {
  const api = `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=320000`;
  const json = await (await fetch(cors + api)).json();
  return json.data?.[0]?.url || null;
}

/* 主入口 */
export async function parsePage(pageUrl) {
  try {
    const url = new URL(pageUrl);
    /* ===== 网易云歌单 ===== */
    if (url.hostname.includes('music.163.com') && url.pathname.includes('/playlist')) {
      const id = url.searchParams.get('id') || url.pathname.match(/playlist\/(\d+)/)?.[1];
      if (!id) throw new Error('未找到歌单 ID');
      // 获取歌单 JSON
      const api = `https://music.163.com/api/playlist/detail?id=${id}`;
      const json = await (await fetch(cors + api)).json();
      const tracks = json.playlist?.tracks || [];
      if (!tracks.length) throw new Error('歌单为空');
      // 生成播放列表
      return tracks.map(t => ({
        name: `${t.name} - ${t.ar?.[0]?.name || ''}`.trim(),
        url: null,            // 先占位
        id: t.id,
        type: '163-track'     // 标记稍后动态取直链
      }));
    }

    /* ===== 网易云单曲 ===== */
    if (url.hostname.includes('music.163.com') && url.pathname.includes('/song')) {
      const id = url.searchParams.get('id') || url.pathname.match(/song\/(\d+)/)?.[1];
      if (!id) throw new Error('未找到歌曲 ID');
      const urlMp3 = await get163TrackUrl(id);
      if (!urlMp3) throw new Error('获取直链失败');
      return [{ name: '网易云单曲', url: urlMp3 }];
    }

    /* ===== 其它站点（保持旧逻辑，可继续扩展） ===== */
    const RULES = [
      { host: /bilibili\.com|b23\.tv/, re: /"audio":\[{"id":\d+,"baseUrl":"([^"]+)"/ },
      { host: /soundcloud\.com/, re: /"transcodings".*?"url":"([^"]+)"/ },
      { host: /youtube\.com|youtu\.be/, re: /"hlsManifestUrl":"([^"]+)"/ }
    ];
    const rule = RULES.find(r => r.host.test(url.hostname));
    if (!rule) throw new Error('暂不支持该站点');
    const html = await (await fetch(cors + pageUrl)).text();
    let [, audioUrl] = html.match(rule.re) || [];
    if (!audioUrl) throw new Error('未找到音频地址');
    audioUrl = JSON.parse(`"${audioUrl}"`);
    if (/soundcloud/.test(url.hostname)) {
      const json = await (await fetch(cors + audioUrl)).json();
      audioUrl = json.url;
    }
    return [{ name: '解析结果', url: audioUrl, type: /youtube/.test(url.hostname) ? 'hls' : 'mp3' }];
  } catch (e) {
    alert('解析失败：' + e.message);
    return null;
  }
}