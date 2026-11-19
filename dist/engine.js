'use strict';
// 通用引擎件：场景注册表、定时器队列、闪信、震屏、粒子、打字机。
// 定时器/打字机思路移植自 ip-please（MIT, ctnyanya）。

const SCENES = {};

let TIMERS = [];
function later(dt, fn) { TIMERS.push({ t: now + dt, fn }); }
function runTimers() {
  const due = TIMERS.filter((x) => x.t <= now);
  if (!due.length) return;
  TIMERS = TIMERS.filter((x) => x.t > now);
  due.sort((a, b) => a.t - b.t).forEach((x) => x.fn());
}
function clearTimers() { TIMERS = []; }

let FLASH = null;
function flash(text) { FLASH = { text, t: st() }; }
function drawFlash() {
  if (!FLASH) return;
  const u = st() - FLASH.t;
  if (u > 2.2) { FLASH = null; return; }
  const a = u < 0.15 ? u / 0.15 : u > 1.8 ? (2.2 - u) / 0.4 : 1;
  const w = tw(FLASH.text, 10) + 16;
  const x = 8, y = 30;
  G.fillStyle = rgba(C.INK, 0.88 * a); G.fillRect(x, y, w, 18);
  outline(x, y, x + w - 1, y + 17, rgba(C.AMBER, a));
  txt(x + 8, y + 4, FLASH.text, 10, rgba(C.CREAM, a));
}

const SHAKE = { t: -9 };
function shake() { SHAKE.t = now; }

let PARTS = [];
function burst(x, y, col, n = 14, spd = 60) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random());
    PARTS.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: now, life: 0.5 + Math.random() * 0.4, col });
  }
}
function updateParticles() {
  PARTS = PARTS.filter((p) => now - p.t < p.life);
  for (const p of PARTS) { p.x += p.vx / 60; p.y += p.vy / 60; p.vy += 2; }
}
function drawParticles() {
  for (const p of PARTS) {
    const u = 1 - (now - p.t) / p.life;
    pt(Math.round(p.x), Math.round(p.y), rgba(p.col, u));
  }
}

// —— 打字机（整段居中逐字） ——
const typeCps = () => 17;
function typeLines(paras) {
  const out = [];
  let t = 0.5;
  paras.forEach((para, pi) => {
    for (const s of para) { out.push({ pi, s, t }); t += [...s].length / typeCps() + 0.12; }
    t += 0.6;
  });
  out.end = t + 1.3;
  out.npara = paras.length;
  return out;
}
function drawTyped(lines) {
  rect(0, 0, W - 1, H - 1, K.INK);
  const total = lines.length + lines.npara - 1;
  let y = Math.floor(H / 2 - total * 18 / 2), last = null;
  for (const { pi, s, t } of lines) {
    if (last !== null && pi !== last) y += 18;
    last = pi;
    const n = Math.floor((st() - t) * typeCps());
    if (n > 0) txt(Math.floor(W / 2 - tw(s) / 2), y, s, 12, K.CREAM, 'la', n);
    y += 18;
  }
  txt(W - 8, H - 14, '点击跳过', 8, K.GREY_D, 'ra');
}
let lastKey = -1;
function typedSounds(lines) {
  const k = Math.floor(st() * typeCps());
  if (k === lastKey) return;
  lastKey = k;
  for (const { s, t } of lines) {
    const i = Math.floor((st() - t) * typeCps());
    if (i >= 0 && i < [...s].length && [...s][i].trim()) { SFX.key(i); break; }
  }
}

// —— 像素按钮 / 面板通用件 ——
function btnBox(b, label, opts = {}) {
  const { size = 10, fill = C.DESK_L, border = C.AMBER, col = C.CREAM, hot = false, disabled = false } = opts;
  const hov = !disabled && inBox(ptr.x, ptr.y, b);
  rect(b[0], b[1], b[2], b[3], rgb(hov ? C.DESK : fill));
  outline(b[0], b[1], b[2], b[3], rgb(disabled ? C.GREY_D : border));
  if (hot) outline(b[0] + 1, b[1] + 1, b[2] - 1, b[3] - 1, rgba(C.AMBER, 0.5));
  txt(Math.floor((b[0] + b[2]) / 2), Math.floor((b[1] + b[3]) / 2 - size / 2), label, size, rgb(disabled ? C.GREY_D : col), 'ma');
  return hov;
}
function panel(x0, y0, x1, y1, fill = C.DESK_D, border = C.OUTLINE) {
  rect(x0, y0, x1, y1, rgb(fill));
  outline(x0, y0, x1, y1, rgb(border));
}