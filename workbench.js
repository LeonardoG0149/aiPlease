'use strict';
// 调参工作台：左娃娃展示台 + 右上工单 + 右中 8 控件 + 底排动作按钮。

const WB = { params: null, drag: null, queue: [] };
const DEFAULT_PARAMS = () => ({ base: 0, temp: 50, ctx: 50, cost: 1, persona: 0, align: 1, net: 0, verbose: 50 });

const ASK_BTN = [184, 302, 320, 350], RAND_BTN = [324, 302, 392, 350], RESET_BTN = [396, 302, 464, 350], EXPORT_BTN = [468, 302, 560, 350];
const Q_PREV = [592, 108, 608, 136], Q_NEXT = [612, 108, 628, 136];

const CTRL = [
  { key: 'base', kind: 'select', box: [184, 150, 408, 180], label: '底座模型' },
  { key: 'persona', kind: 'select', box: [412, 150, 632, 180], label: '人设外套' },
  { key: 'temp', kind: 'slider', box: [184, 184, 408, 214], label: '温度' },
  { key: 'ctx', kind: 'slider', box: [412, 184, 632, 214], label: '上下文长度' },
  { key: 'cost', kind: 'step', box: [184, 218, 408, 248], label: '成本档位' },
  { key: 'align', kind: 'seg', box: [412, 218, 632, 248], label: '安全对齐' },
  { key: 'net', kind: 'toggle', box: [184, 252, 408, 282], label: '联网搜索' },
  { key: 'verbose', kind: 'slider', box: [412, 252, 632, 282], label: '话痨度' },
];

function personaUnlocked(i) { return !PERSONAS[i].cost || S.unlocked.includes('p' + i); }
function unlockedPersonaIdx() { return PERSONAS.map((p, i) => i).filter(personaUnlocked); }

const TRI_L = ['X...', 'XX..', 'XXX.', 'XXXX', 'XXX.', 'XX..', 'X...'];
const TRI_R = ['...X', '..XX', '.XXX', 'XXXX', '.XXX', '..XX', '...X'];
function triBtn(b, dir) {
  const hov = inBox(ptr.x, ptr.y, b);
  rect(b[0], b[1], b[2], b[3], rgb(hov ? C.DESK : C.DESK_L));
  outline(b[0], b[1], b[2], b[3], rgb(C.GREY_D));
  pattern(dir < 0 ? TRI_R : TRI_L, Math.floor((b[0] + b[2]) / 2) - 2, Math.floor((b[1] + b[3]) / 2) - 3, { X: K.CREAM });
}

function ctrlValueText(c) {
  const p = WB.params;
  if (c.key === 'base') return BASES[p.base].name;
  if (c.key === 'persona') return PERSONAS[p.persona].name + (personaUnlocked(p.persona) ? '' : '（锁）');
  if (c.key === 'cost') return COSTS[p.cost];
  if (c.key === 'temp') return p.temp + '°';
  if (c.key === 'ctx') return p.ctx + 'K';
  if (c.key === 'verbose') return p.verbose + '%';
  return '';
}

function drawCtrl(c) {
  const [x0, y0, x1, y1] = c.box;
  const p = WB.params;
  panel(x0, y0, x1, y1, C.DESK_D, C.OUTLINE);
  txt(x0 + 5, y0 + 3, c.label, 10, K.GREY);
  const wy = y0 + 14;
  if (c.kind === 'select') {
    triBtn([x0 + 4, wy, x0 + 20, y1 - 4], -1);
    triBtn([x1 - 20, wy, x1 - 4, y1 - 4], 1);
    txt(Math.floor((x0 + x1) / 2), wy + 2, ctrlValueText(c), 10, K.AMBER, 'ma');
  } else if (c.kind === 'slider') {
    const tx0 = x0 + 6, tx1 = x1 - 34;
    rect(tx0, wy + 6, tx1, wy + 8, K.DESK);
    const u = p[c.key] / 100;
    const kx = Math.round(tx0 + (tx1 - tx0) * u);
    rect(tx0, wy + 6, kx, wy + 8, K.AMBER_D);
    rect(kx - 3, wy + 1, kx + 3, wy + 13, K.AMBER);
    outline(kx - 3, wy + 1, kx + 3, wy + 13, K.INK);
    txt(x1 - 6, wy + 2, ctrlValueText(c), 10, K.CREAM, 'ra');
  } else if (c.kind === 'step') {
    btnBox([x0 + 4, wy, x0 + 24, y1 - 4], '-', { size: 10, fill: C.DESK, border: C.GREY_D });
    btnBox([x1 - 24, wy, x1 - 4, y1 - 4], '+', { size: 10, fill: C.DESK, border: C.GREY_D });
    txt(Math.floor((x0 + x1) / 2), wy + 2, ctrlValueText(c), 10, K.AMBER, 'ma');
  } else if (c.kind === 'seg') {
    const w = Math.floor((x1 - x0 - 8) / 3);
    for (let i = 0; i < 3; i++) {
      const b = [x0 + 4 + i * w, wy, x0 + 4 + (i + 1) * w - 2, y1 - 4];
      const on = p.align === i;
      rect(b[0], b[1], b[2], b[3], rgb(on ? C.BRICK : C.DESK));
      outline(b[0], b[1], b[2], b[3], rgb(on ? C.AMBER : C.GREY_D));
      txt(Math.floor((b[0] + b[2]) / 2), b[1] + 3, ALIGNS[i], 10, on ? K.CREAM : K.GREY, 'ma');
    }
  } else if (c.kind === 'toggle') {
    const on = !!p.net;
    const b = [x0 + 6, wy + 1, x0 + 30, wy + 13];
    rect(b[0], b[1], b[2], b[3], rgb(on ? C.GREEN_D : C.DESK));
    outline(b[0], b[1], b[2], b[3], rgb(on ? C.ACID : C.GREY_D));
    rect(on ? b[2] - 8 : b[0] + 2, b[1] + 2, on ? b[2] - 2 : b[0] + 8, b[3] - 2, rgb(on ? C.ACID : C.GREY));
    txt(x0 + 38, wy + 2, on ? '开 · 天线已装' : '关 · 离线模式', 10, on ? K.ACID : K.GREY);
  }
}

function sliderSet(c, x) {
  const tx0 = c.box[0] + 6, tx1 = c.box[2] - 34;
  WB.params[c.key] = Math.round(clamp((x - tx0) / (tx1 - tx0)) * 100);
}

function cyclePersona(dir) {
  const idx = unlockedPersonaIdx();
  const at = idx.indexOf(WB.params.persona);
  WB.params.persona = idx[(at + dir + idx.length) % idx.length];
}

function drawQueue() {
  for (let i = 0; i < WB.queue.length; i++) {
    const q = WB.queue[i];
    const x = 20 + (((q.x0 - now * q.speed) % 500) + 500) % 500;
    tinyPerson(x, 88, rgb(q.coat), q.hat ? rgb(q.hat) : null, Math.floor(now * 4 + i) % 2);
  }
  const cust = currentQuestion().cust;
  rect(548, 60, 576, 88, K.BOOTH_WALL);
  rect(552, 66, 566, 80, K.AMBER_D);
  tinyPerson(560, 88, rgb(cust.coat), cust.hat ? rgb(cust.hat) : null, 0);
  const nw = tw(cust.name, 10) + 8;
  rect(560 - nw / 2, 44, 560 + nw / 2, 56, rgba(C.INK, 0.8));
  txt(560, 46, cust.name, 10, K.CREAM, 'ma');
}

function exportCard() {
  const [cv, g] = makeCanvas(240, 140);
  setCtx(g);
  rect(0, 0, 239, 139, K.PAPER);
  outline(0, 0, 239, 139, K.BRICK);
  outline(2, 2, 237, 137, K.BRICK);
  txt(120, 8, 'AI, PLEASE 搭配卡', 10, K.BRICK, 'ma');
  drawDoll(52, 116, WB.params, 0, 'happy');
  const p = WB.params;
  const rows = [
    '底座 ' + BASES[p.base].name,
    '外套 ' + PERSONAS[p.persona].name,
    '温度 ' + p.temp + '° · 上下文 ' + p.ctx + 'K',
    '成本 ' + COSTS[p.cost] + ' · 对齐 ' + ALIGNS[p.align],
    '联网 ' + (p.net ? '开' : '关') + ' · 话痨 ' + p.verbose + '%',
  ];
  rows.forEach((s, i) => txt(104, 30 + i * 16, s, 8, K.TEXT));
  txt(120, 122, '同一问题 · 不同搭配 · 不同答案', 8, K.TEXT_L, 'ma');
  setCtx(F.getContext('2d'));
  const a = document.createElement('a');
  a.download = 'ai-please-card.png';
  a.href = cv.toDataURL('image/png');
  a.click();
  SFX.play('coin');
  flash('搭配卡已导出，快去晒图');
}

SCENES.workbench = {
  enter() {
    WB.params = S.params;
    WB.drag = null;
    if (!WB.queue.length) {
      const rng = (i) => ((i * 2654435761) >>> 0) / 4294967296;
      for (let i = 0; i < 9; i++) {
        WB.queue.push({ x0: i * 55 + 10, speed: 6 + rng(i) * 6, coat: QUESTIONS[i % QUESTIONS.length].cust.coat, hat: i % 3 === 0 ? QUESTIONS[i % QUESTIONS.length].cust.hat : null });
      }
    }
    SFX.music(true);
    SFX.ambient(true);
    if (S.day === 1 && S.orderIdx === 0 && !S.tut) { flash('点滑条给 AI 换装，然后点「提问」'); S.tut = 1; }
  },
  update() {},
  render() {
    drawBg();
    drawQueue();
    // 娃娃展示台
    panel(8, 104, 176, 316, C.DESK_D, C.OUTLINE);
    line(92, 104, 92, 126, K.METAL_D);
    rect(84, 126, 100, 132, K.METAL);
    rect(86, 132, 98, 134, K.AMBER);
    G.fillStyle = rgba(C.AMBER, 0.07);
    G.beginPath(); G.moveTo(86, 134); G.lineTo(98, 134); G.lineTo(150, 252); G.lineTo(34, 252); G.closePath(); G.fill();
    rect(20, 252, 164, 258, K.COUNTER);
    rect(20, 258, 164, 262, K.COUNTER_D);
    drawDoll(92, 250, WB.params, now, ptr.down ? 'talk' : 'idle');
    txt(92, 266, BASES[WB.params.base].name, 10, K.AMBER, 'ma');
    const pv = wrap(personaPreview(WB.params), 10, 160);
    pv.slice(0, 3).forEach((s, i) => txt(92, 280 + i * 10, s, 10, K.GREY, 'ma'));
    // 工单条
    panel(184, 104, 632, 142, C.DESK_D, C.OUTLINE);
    txt(190, 108, '工单 #' + (S.orderIdx + 1) + ' / ' + ORDERS_PER_DAY, 10, K.AMBER);
    const q = currentQuestion();
    wrap(q.text, 10, 392).slice(0, 2).forEach((s, i) => txt(190, 119 + i * 12, s, 10, K.CREAM));
    triBtn(Q_PREV, -1);
    triBtn(Q_NEXT, 1);
    // 控件
    for (const c of CTRL) drawCtrl(c);
    // 顾客喜好纸条：揭示六维偏好中的五维，被掩的一维写明维度名＋随缘
    panel(184, 284, 632, 300, C.PAPER, C.BRICK_D);
    txt(190, 288, '顾客喜好纸条：' + hintOf(q, S.stars.length + S.day), 10, K.TEXT);
    // 底排
    btnBox(ASK_BTN, '提 问', { size: 12, fill: C.BRICK, border: C.AMBER, hot: true });
    btnBox(RAND_BTN, '随机', { size: 10 });
    btnBox(RESET_BTN, '重置', { size: 10 });
    btnBox(EXPORT_BTN, '导出搭配卡', { size: 8 });
    // 时钟
    txt(10, 334, DATE_STR[S.day - 1], 10, K.GREY);
    const mins = 3 + S.orderIdx * 40;
    txt(10, 346, '0' + (6 + Math.floor(mins / 60)) + ':' + String(mins % 60).padStart(2, '0'), 10, K.LED);
    txt(176, 346, '生命线 2.0 星', 10, K.GREY, 'ra');
  },
  down(x, y) {
    if (inBox(x, y, ASK_BTN)) {
      const q = currentQuestion();
      const res = composeAnswer(WB.params, q);
      const score = scoreOf(WB.params, q);
      GAME.submit(res, score, starsOf(score), q);
      SFX.play('stamp_approve');
      go('answer');
      return;
    }
    if (inBox(x, y, RAND_BTN)) {
      const idx = unlockedPersonaIdx();
      Object.assign(WB.params, {
        base: Math.floor(Math.random() * BASES.length), temp: Math.floor(Math.random() * 101),
        ctx: Math.floor(Math.random() * 101), cost: Math.floor(Math.random() * 3),
        persona: idx[Math.floor(Math.random() * idx.length)], align: Math.floor(Math.random() * 3),
        net: Math.random() < 0.5 ? 1 : 0, verbose: Math.floor(Math.random() * 101),
      });
      SFX.play('select'); burst(92, 220, C.AMBER, 10, 40);
      return;
    }
    if (inBox(x, y, RESET_BTN)) { WB.params = Object.assign(WB.params, DEFAULT_PARAMS()); SFX.play('click'); return; }
    if (inBox(x, y, EXPORT_BTN)) { exportCard(); return; }
    if (inBox(x, y, Q_PREV) || inBox(x, y, Q_NEXT)) {
      const n = availableQuestions().length;
      S.qIdx = (S.qIdx + (inBox(x, y, Q_NEXT) ? 1 : -1) + n) % n;
      SFX.paper(3);
      return;
    }
    for (const c of CTRL) {
      if (!inBox(x, y, c.box)) continue;
      const p = WB.params, [x0, y0, x1, y1] = c.box;
      if (c.kind === 'slider') { sliderSet(c, x); WB.drag = c; SFX.play('click'); }
      else if (c.kind === 'select') {
        if (c.key === 'persona') cyclePersona(x < (x0 + x1) / 2 ? -1 : 1);
        else p.base = (p.base + (x < (x0 + x1) / 2 ? -1 : 1) + BASES.length) % BASES.length;
        SFX.play('select');
      } else if (c.kind === 'step') { p.cost = Math.max(0, Math.min(2, p.cost + (x < (x0 + x1) / 2 ? -1 : 1))); SFX.play('click'); }
      else if (c.kind === 'seg') { p.align = Math.max(0, Math.min(2, Math.floor((x - x0 - 4) / ((x1 - x0 - 8) / 3)))); SFX.play('click'); }
      else if (c.kind === 'toggle') { p.net = p.net ? 0 : 1; SFX.play(p.net ? 'inspect_on' : 'inspect_off'); }
      return;
    }
  },
  move(x, y) { if (WB.drag) sliderSet(WB.drag, x); },
  up() { WB.drag = null; },
};