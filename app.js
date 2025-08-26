/* ====== Himusic 纯前端版 ====== */
const audio = document.getElementById('audio');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const playlistEl = document.getElementById('playlist');
let analyser, dataArray, bufferLength, particles = [];
const playlist = [];
let current = 0;

/* —— 画布自适应 —— */
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

/* —— Web Audio —— */
function initAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const src = ctx.createMediaElementSource(audio);
  src.connect(analyser);
  analyser.connect(ctx.destination);
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  particles = [];
  const R = Math.min(canvas.width, canvas.height) * 0.35;
  for (let i = 0; i < bufferLength; i++)
    particles.push({ angle: (i / bufferLength) * 2 * Math.PI, baseR: R });
}
function draw() {
  requestAnimationFrame(draw);
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  for (let p of particles) {
    const amp = dataArray[Math.floor(p.angle / 2 / Math.PI * bufferLength)] / 255;
    const r = p.baseR + amp * 120;
    ctx.fillStyle = `h