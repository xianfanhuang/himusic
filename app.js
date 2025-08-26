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

/* ========== 网络直链 ========== */
import {parsePage} from './parser.js';
async function loadURL() {
  const raw = document.getElementById('urlInput').value.trim();
  if (!raw) return;

  let item;
  // 如果是直链 mp3/flac/m4a
  if (/\.(mp3|flac|m4a|wav)(\?.*)?$/i.test(raw)) {
    item = {url: raw, name: decodeURIComponent(raw.split('/').pop())};
  } else {
    // 交给 parser
    const res = await parsePage(raw);
    if (!res) return;
    const name = new URL(raw).pathname.split('/').pop() || '未知';
    item = {url: res.url, name, type: res.type};
  }
  addToPlaylist(item);
  playTrack(playlist.length - 1);
}

function addToPlaylist(item) {
  playlist.push(item);
  const li = document.createElement('li');
  li.textContent = item.name;
  li.onclick = () => playTrack(playlist.indexOf(item));
  playlistEl.appendChild(li);
}

/* ========== 首次点击解锁 AudioContext ========== */
document.body.addEventListener('click', () => {
  if (!analyser) initAudio();
}, { once: true });

/* ========== 启动绘制 ========== */
draw();