'use strict';
// 场景机、输入分发、主循环。通用注册表版（壳移植自 ip-please，MIT, ctnyanya）。

let now = 0, scene = 'boot', sceneT0 = 0;
const ptr = { x: -99, y: -99, down: false, mouse: false };
let canvasEl = null, F = null;
const st = () => now - sceneT0;

function go(name) {
  clearTimers();
  FLASH = null;
  if (!S.params && name !== 'title' && name !== 'intro') { if (!loadSave()) newGame(); }
  scene = name; sceneT0 = now;
  lastKey = -1;
  const sc = SCENES[name];
  if (sc && sc.enter) sc.enter();
}

function toGame(ev) {
  const r = canvasEl.getBoundingClientRect();
  return [Math.floor((ev.clientX - r.left) * W / r.width), Math.floor((ev.clientY - r.top) * H / r.height)];
}

function onDown(ev) {
  SFX.init();
  const [x, y] = toGame(ev);
  Object.assign(ptr, { x, y, down: true, mouse: ev.pointerType === 'mouse' });
  if (canvasEl.setPointerCapture) canvasEl.setPointerCapture(ev.pointerId);
  ev.preventDefault();
  const sc = SCENES[scene];
  if (sc && sc.down) sc.down(x, y);
  else if (sc && sc.click) sc.click(x, y);
}

function onMove(ev) {
  const [x, y] = toGame(ev);
  Object.assign(ptr, { x, y, mouse: ev.pointerType === 'mouse' });
  const sc = SCENES[scene];
  if (ptr.down && sc && sc.move) sc.move(x, y);
}

function onUp(ev) {
  const [x, y] = toGame(ev);
  Object.assign(ptr, { x, y, down: false });
  const sc = SCENES[scene];
  if (sc && sc.up) sc.up(x, y);
}

function update() {
  runTimers();
  updateParticles();
  const sc = SCENES[scene];
  if (sc && sc.update) sc.update();
}

function render() {
  setCtx(F.getContext('2d'));
  const sc = SCENES[scene];
  if (sc && sc.render) sc.render(st());
  drawParticles();
  drawFlash();
  const g = canvasEl.getContext('2d');
  g.imageSmoothingEnabled = false;
  let ox = 0, oy = 0;
  const k = Math.floor((now - SHAKE.t) * 30);
  if (k >= 0 && k < 4) [ox, oy] = [[0, 3], [1, -2], [-1, 1], [0, -1]][k];
  g.fillStyle = K.INK; g.fillRect(0, 0, W, H);
  g.drawImage(F, ox, oy);
  if (ptr.mouse) {
    setCtx(g);
    drawCursor(ptr.x, ptr.y, ptr.down ? 'hand' : 'arrow');
  }
}

let vw = 0, vh = 0, vd = 0;
function loop(ts) {
  now = ts / 1000;
  if (window.innerWidth !== vw || window.innerHeight !== vh || window.devicePixelRatio !== vd) {
    vw = window.innerWidth; vh = window.innerHeight; vd = window.devicePixelRatio;
    fit();
  }
  update();
  render();
  requestAnimationFrame(loop);
}

function fit() {
  // 整数倍设备像素缩放：pixelated 放大不丢笔画，小字更清楚
  const dsf = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const n = Math.floor(s * dsf);
  const k = n >= 1 ? n / dsf : s;
  canvasEl.style.width = `${W * k}px`;
  canvasEl.style.height = `${H * k}px`;
}

function toggleMute() {
  SFX.init();
  SFX.toggleMute();
  updateMuteLabel();
}

function updateMuteLabel() {
  const b = document.getElementById('mute');
  if (b) b.textContent = SFX.muted ? '声音：关' : '声音：开';
}

function boot() {
  canvasEl = document.getElementById('game');
  canvasEl.width = W; canvasEl.height = H;
  [F] = makeCanvas(W, H);
  fit();
  window.addEventListener('resize', fit);
  canvasEl.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') toggleMute(); });
  loadImages().then(() => {
    sceneT0 = performance.now() / 1000;
    const jump = location.hash.slice(1);
    go(SCENES[jump] ? jump : 'title');
    requestAnimationFrame(loop);
    window.__ready = true;
  });
}

window.addEventListener('DOMContentLoaded', boot);