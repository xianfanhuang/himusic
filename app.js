/* ========== 全局变量 ========== */
const audio = document.getElementById('audio');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const playlistEl = document.getElementById('playlist');
let analyser, dataArray, bufferLength, particles = [];
const playlist = [];
let current = 0;

/* ========== 初始化画布 ========== */
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

/* ========== Web Audio ========== */
function initAudio() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  const source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  initParticles();
}

/* ========== 粒子系统 ========== */
function initParticles() {
  particles = [];
  const radius = Math.min(canvas.width, canvas.height) * 0.35;
  for (let i = 0; i < bufferLength; i++) {
    const angle = (i / bufferLength) * Math.PI * 2;
    particles.push({ angle, radius, baseR: radius });
  }
}

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteFrequencyData(dataArray);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const amp = dataArray[i] / 255;
    const r = p.baseR + amp * 120;
    const x = Math.cos(p.angle) * r;
    const y = Math.sin(p.angle) * r;
    const size = 1 + amp * 4;
    ctx.fillStyle = `hsl(${Math.floor(amp * 360)},100%,70%)`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ========== 播放控制 ========== */
audio.addEventListener('ended', () => {
  current = (current + 1) % playlist.length;
  playTrack(current);
});

function playTrack(index) {
  if (!playlist[index]) return;
  current = index;
  const {url, type} = playlist[index];

  // 如果是 HLS
  if (type === 'hls' && window.Hls && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(audio);
  } else {
    audio.src = url;
  }
  audio.play();
}
/* ========== 本地文件处理 ========== */
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', e => handleFiles(e.target.files));

const dropZone = document.getElementById('dropZone');
['dragenter', 'dragover', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    if (evt === 'drop') handleFiles(e.dataTransfer.files);
  })
);

function handleFiles(files) {
  for (const f of files) {
    const url = URL.createObjectURL(f);
    addToPlaylist({ url, name: f.name });
  }
  if (playlist.length === files.length) playTrack(0);
}

/* ========== 网络直链 & 页面解析 ========== */
const cors = 'https://cors-anywhere.herokuapp.com/';

/* 网易云：根据歌曲 id 取直链 */
async function get163TrackUrl(id) {
  const api = `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=320000`;
  const json = await (await fetch(cors + api)).json();
  return json.data?.[0]?.url || null;
}

/* 通用解析入口 */
async function parsePage(pageUrl) {
  try {
    const url = new URL(pageUrl);

    /* 1. 网易云歌单 */
    if (url.hostname.includes('music.163.com') && url.pathname.includes('/playlist')) {
      const id = url.searchParams.get('id') || url.pathname.match(/playlist\/(\d+)/)?.[1];
      if (!id) throw new Error('未找到歌单 ID');
      const api = `https://music.163.com/api/playlist/detail?id=${id}`;
      const json = await (await fetch(cors + api)).json();
      const tracks = json.playlist?.tracks || [];
      if (!tracks.length) throw new Error('歌单为空');
      return tracks.map(t => ({
        name: `${t.name} - ${t.ar?.[0]?.name || ''}`.trim(),
        url: null,
        id: t.id,
        type: '163-track'
      }));
    }

    /* 2. 网易云单曲 */
    if (url.hostname.includes('music.163.com') && url.pathname.includes('/song')) {
      const id = url.searchParams.get('id') || url.pathname.match(/song\/(\d+)/)?.[1];
      if (!id) throw new Error('未找到歌曲 ID');
      const mp3 = await get163TrackUrl(id);
      if (!mp3) throw new Error('获取直链失败');
      return [{ name: '网易云单曲', url: mp3 }];
    }

    /* 3. 其它站点（B站 / SoundCloud / YouTube HLS） */
    const RULES = [
      { host: /bilibili\.com|b23\.tv/, re: /"audio":\[{"id":\d+,"baseUrl":"([^"]+)"/ },
      { host: /soundcloud\.com/,       re: /"transcodings".*?"url":"([^"]+)"/ },
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
    return [{
      name: '解析音频',
      url: audioUrl,
      type: /youtube/.test(url.hostname) ? 'hls' : 'mp3'
    }];
  } catch (e) {
    alert('解析失败：' + e.message);
    return null;
  }
}

/* ========== 播放控制 ========== */
audio.addEventListener('ended', () => {
  current = (current + 1) % playlist.length;
  playTrack(current);
});

async function playTrack(index) {
  if (!playlist[index]) return;
  current = index;
  const item = playlist[index];

  // 网易云 track：动态取直链
  if (item.type === '163-track') {
    item.url = await get163TrackUrl(item.id);
    if (!item.url) return alert('获取直链失败');
  }

  // HLS 处理
  if (item.type === 'hls' && window.Hls && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(item.url);
    hls.attachMedia(audio);
  } else {
    audio.src = item.url;
  }
  audio.play();
  document.title = '♪ ' + item.name;
}

/* ========== 本地文件处理 ========== */
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', e => handleFiles(e.target.files));

const dropZone = document.getElementById('dropZone');
['dragenter', 'dragover', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, e => {
    e.preventDefault();
    if (evt === 'drop') handleFiles(e.dataTransfer.files);
  })
);

function handleFiles(files) {
  [...files].forEach(f => {
    const url = URL.createObjectURL(f);
    addToPlaylist({ name: f.name, url });
  });
  if (playlist.length === files.length) playTrack(0);
}

/* ========== 网络输入 ========== */
async function loadURL() {
  const raw = document.getElementById('urlInput').value.trim();
  if (!raw) return;

  let list;
  // 直链 mp3/flac/m4a
  if (/\.(mp3|flac|m4a|wav)(\?.*)?$/i.test(raw)) {
    list = [{ name: decodeURIComponent(raw.split('/').pop()), url: raw }];
  } else {
    list = await parsePage(raw);
  }
  if (!list) return;

  list.forEach(addToPlaylist);
  playTrack(playlist.length - list.length);
}

function addToPlaylist(item) {
  playlist.push(item);
  const li = document.createElement('li');
  li.textContent = item.name;
  li.onclick = () => playTrack(playlist.indexOf(item));
  playlistEl.appendChild(li);
}

/* ========== 首次解锁 AudioContext ========== */
document.body.addEventListener('click', () => {
  if (!analyser) initAudio();
}, { once: true });

/* ========== 启动绘制 ========== */
draw();