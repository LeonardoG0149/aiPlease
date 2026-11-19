'use strict';
// 标题 / 开场 / 日卡 / 答案演出 / 应用商店 / 报纸 / 结局 / 下架。

const START_BTN = [240, 200, 400, 230], CONT_BTN = [240, 238, 400, 266];
const ANSWER_BTN = [470, 310, 584, 338];
const STORE_BTN = [250, 300, 390, 330];
const NEWS_BTN = [470, 312, 584, 340];
const RESTART_BTN = [250, 296, 390, 326];

SCENES.title = {
  enter() { SFX.music(false); SFX.ambient(false); SFX.play('title', 0.8); },
  update() {},
  render() {
    drawBg();
    darken(0.86);
    spr('emblem', Math.floor(W / 2) - 11, 34);
    bigText(W / 2, 92, 'AI, PLEASE', 12, 3, K.CREAM, K.BRICK_D);
    txt(W / 2, 136, '请调好你的模型', 12, K.AMBER, 'ma');
    txt(W / 2, 156, 'A MODEL DRESS-UP THRILLER', 10, K.GREY, 'ma');
    btnBox(START_BTN, '开始上班', { size: 12, fill: C.BRICK, border: C.AMBER, hot: true });
    if (hasSave()) btnBox(CONT_BTN, '继续上班', { size: 10 });
    txt(W / 2, 296, '给 AI 换装调参 · 同一问题不同搭配不同答案 · 全程约 8 分钟', 10, K.GREY, 'ma');
    txt(W / 2, 312, '画面与音效全程序生成 · 致敬 Papers, Please 与 IP, PLEASE', 10, K.GREY, 'ma');
    txt(W / 2, 328, '声音默认开 · 按 M 或右上角静音', 10, K.GREY, 'ma');
  },
  click(x, y) {
    if (inBox(x, y, START_BTN)) { newGame(); go('intro'); return; }
    if (hasSave() && inBox(x, y, CONT_BTN) && loadSave()) go('workbench');
  },
};

let INTRO_LINES = null;
SCENES.intro = {
  enter() { INTRO_LINES = typeLines(INTRO); },
  update() { typedSounds(INTRO_LINES); if (st() > INTRO_LINES.end) go('daycard'); },
  render() { drawTyped(INTRO_LINES); },
  click() { go('daycard'); },
};

SCENES.daycard = {
  enter() { SFX.play('day_hit'); },
  update() { if (st() > 1.9) go('workbench'); },
  render() {
    rect(0, 0, W - 1, H - 1, K.INK);
    bigText(W / 2, 120, '第 ' + S.day + ' 天', 12, 3, K.AMBER, K.BRICK_D);
    txt(W / 2, 180, DATE_STR[S.day - 1], 12, K.CREAM, 'ma');
    txt(W / 2, 208, '今日工单 ' + ORDERS_PER_DAY + ' 份 · 商店均分生命线 2.0 星', 10, K.GREY, 'ma');
    txt(W / 2, 244, '点击继续', 10, K.GREY, 'ma');
  },
  click() { go('workbench'); },
};

SCENES.answer = {
  enter() {
    const R = GAME.result;
    R.lines = wrap(R.text, 10, 496);
    R.total = [...R.text].length;
    R.stamped = false; R.done = false; R.skip = false; R.lastN = -1;
    SFX.printer(Math.min(8, R.total / 22 + 0.5));
  },
  update() {
    const R = GAME.result;
    const n = R.skip ? R.total : Math.max(0, Math.floor((st() - 0.4) * 22));
    if (n !== R.lastN) { R.lastN = n; if (n < R.total) SFX.key(n); }
    if (n >= R.total && !R.stamped) {
      R.stamped = true;
      SFX.play(R.stars >= 4 ? 'stamp_approve' : 'stamp_deny');
      shake();
      burst(500, 240, R.stars >= 4 ? C.GREEN : C.RED, 16, 70);
      later(0.5, () => { R.done = true; });
    }
  },
  render() {
    const R = GAME.result;
    rect(0, 0, W - 1, H - 1, K.INK);
    panel(56, 24, 584, 300, C.PAPER, C.BRICK);
    outline(58, 26, 582, 298, rgb(C.PAPER_D));
    txt(70, 34, '回答工单 #' + R.orderNo, 10, K.BRICK);
    txt(570, 36, '质量分 ' + R.score, 10, K.TEXT_L, 'ra');
    wrap(R.q.text, 10, 480).slice(0, 2).forEach((s, i) => txt(70, 50 + i * 12, s, 10, K.TEXT_L));
    rect(70, 74, 570, 74, K.PAPER_LINE);
    for (let y = 100; y <= 244; y += 16) rect(70, y, 570, y, K.PAPER_LINE);
    const n = R.skip ? R.total : Math.max(0, Math.floor((st() - 0.4) * 22));
    let used = 0;
    R.lines.forEach((s, i) => {
      const len = [...s].length;
      const take = Math.max(0, Math.min(len, n - used));
      if (take > 0) txt(70, 84 + i * 16, s, 10, K.TEXT, 'la', take);
      used += len;
    });
    if (R.stamped) {
      spr(R.stars >= 4 ? 'stamp_good' : 'stamp_bad', 468, 232);
      txt(70, 262, '顾客预计评分', 10, K.TEXT_L);
      for (let i = 0; i < 5; i++) spr(i < R.stars ? 'star1' : 'star0', 70 + i * 12, 274);
    }
    if (R.done) btnBox(ANSWER_BTN, '交给顾客', { size: 10, fill: C.BRICK, border: C.AMBER, hot: true });
    else txt(70, 318, '点击纸面跳过打字', 10, K.GREY);
  },
  click(x, y) {
    const R = GAME.result;
    if (R.done && inBox(x, y, ANSWER_BTN)) { go('store'); return; }
    if (!R.stamped) R.skip = true;
  },
};

SCENES.store = {
  enter() {
    const R = GAME.result;
    R.revSkip = false;
    for (let i = 0; i < R.stars; i++) later(0.3 + i * 0.22, () => SFX.play('star'));
    if (R.stars <= 2) later(0.3 + R.stars * 0.22, () => SFX.play('bad'));
    later(1.1, () => SFX.play('coin'));
    if (GAME.newUnlocks.length) later(1.4, () => SFX.play('unlock'));
  },
  update() {},
  render() {
    const R = GAME.result, p = S.params;
    rect(0, 0, W - 1, H - 1, K.INK);
    panel(170, 20, 470, 340, C.DESK_D, C.METAL);
    txt(320, 28, '应用商店', 10, K.CREAM, 'ma');
    drawDollHead(196, 52, p, now);
    txt(214, 44, BASES[p.base].name + ' · ' + PERSONAS[p.persona].name + '版', 10, K.AMBER);
    txt(214, 60, 'v1.' + S.day + '.' + S.orderIdx + ' · 对齐部认证', 10, K.GREY);
    for (let i = 0; i < 5; i++) {
      const on = i < R.stars && st() > 0.3 + i * 0.22;
      spr(on ? 'star1' : 'star0', 190 + i * 22, 78);
    }
    const a = avg();
    txt(454, 80, '均分 ' + a.toFixed(1), 10, a >= 2 ? K.ACID : K.RED, 'ra');
    panel(186, 100, 454, 214, C.PAPER, C.PAPER_D);
    txt(194, 108, R.rev.user, 10, K.BRICK);
    for (let i = 0; i < 5; i++) spr(i < R.stars ? 'star1' : 'star0', 396 + i * 11, 108);
    const rn = R.revSkip ? 999 : Math.max(0, Math.floor((st() - 1.0) * 30));
    let used = 0;
    wrap(R.rev.text, 10, 250).slice(0, 5).forEach((s, i) => {
      const len = [...s].length;
      const take = Math.max(0, Math.min(len, rn - used));
      if (take > 0) txt(194, 136 + i * 14, s, 10, K.TEXT, 'la', take);
      used += len;
    });
    const bob = Math.round(seg(st(), 1.1, 1.6) * 4);
    txt(194, 224 - bob, '+' + R.gain + ' 对齐币', 10, K.GOLD);
    txt(454, 224, '持有 ' + S.coins, 10, K.GREY, 'ra');
    GAME.newUnlocks.forEach((s, i) => txt(194, 238 + i * 12, '解锁 ' + s, 10, K.ACID));
    if (a < 2.4 && a >= 2) txt(320, 286, '危险：接近下架生命线 2.0', 10, K.RED, 'ma');
    const last = S.orderIdx + 1 >= ORDERS_PER_DAY;
    btnBox(STORE_BTN, last ? '今日结算' : '下一单', { size: 10, fill: C.BRICK, border: C.AMBER, hot: true });
  },
  click(x, y) {
    if (st() < 0.6) return;
    if (inBox(x, y, STORE_BTN)) { GAME.advance(); return; }
    GAME.result.revSkip = true;
  },
};

SCENES.newspaper = {
  enter() { SFX.play('whoosh'); SFX.paper(31); },
  update() {},
  render() {
    rect(0, 0, W - 1, H - 1, K.INK);
    panel(40, 12, 600, 348, C.PAPER, C.TEXT);
    bigText(320, 24, NEWSPAPER.name, 12, 2, K.TEXT);
    txt(320, 52, NEWSPAPER.sub, 10, K.TEXT_L, 'ma');
    txt(320, 64, DATE_STR[S.day - 1] + ' · 第 ' + S.day + ' 期', 10, K.TEXT_L, 'ma');
    rect(56, 76, 584, 76, K.TEXT);
    rect(56, 78, 584, 78, K.TEXT);
    const d = NEWSPAPER.days[S.day - 1];
    bigText(320, 88, d.head, 12, 1, K.BRICK);
    wrap(d.flavor, 10, 520).forEach((s, i) => txt(60, 112 + i * 14, s, 10, K.TEXT));
    const da = S.dayStars.length ? S.dayStars.reduce((x, y) => x + y, 0) / S.dayStars.length : 0;
    txt(80, 170, '今日完成 ' + S.dayStars.length + ' 单', 10, K.TEXT);
    txt(260, 170, '今日均分 ' + da.toFixed(1), 10, K.TEXT);
    txt(440, 170, '总均分 ' + avg().toFixed(1), 10, K.TEXT);
    spr('coin', 80, 190);
    txt(96, 192, '对齐币 ' + S.coins, 10, K.TEXT);
    txt(80, 220, '本日解锁', 10, K.TEXT_L);
    if (GAME.dayUnlocks.length) GAME.dayUnlocks.forEach((s, i) => txt(80, 234 + i * 14, s, 10, K.GREEN_D));
    else txt(80, 234, '（攒对齐币可解锁隐藏外套与隐藏工单）', 10, K.TEXT_L);
    spr('seal', 520, 236);
    spr('star1', 500, 280); spr('star1', 514, 280); spr('star1', 528, 280);
    btnBox(NEWS_BTN, '继续', { size: 10, fill: C.BRICK, border: C.AMBER, hot: true });
  },
  click(x, y) { if (inBox(x, y, NEWS_BTN)) GAME.nextDay(); },
};

function drawEndStats(y) {
  txt(W / 2, y, '总工单 ' + S.stars.length + ' · 商店均分 ' + avg().toFixed(1) + ' · 对齐币 ' + S.coins, 10, K.GREY, 'ma');
}

SCENES.ending = {
  enter() { SFX.music(false); SFX.play('end', 0.8); },
  update() {},
  render() {
    const E = ENDINGS[endingOf(avg())];
    rect(0, 0, W - 1, H - 1, K.INK);
    spr('emblem', Math.floor(W / 2) - 11, 36);
    bigText(W / 2, 88, E.title, 12, 3, endingOf(avg()) === 'best' ? K.AMBER : K.CREAM, K.BRICK_D);
    E.lines.forEach((s, i) => txt(W / 2, 148 + i * 20, s, 12, K.CREAM, 'ma'));
    drawEndStats(248);
    txt(W / 2, 268, '感谢游玩 · 全预设演出 · 致敬 Papers, Please 与 IP, PLEASE', 10, K.GREY, 'ma');
    btnBox(RESTART_BTN, '再来一局', { size: 10, fill: C.BRICK, border: C.AMBER, hot: true });
  },
  click(x, y) { if (st() > 1.5 && inBox(x, y, RESTART_BTN)) { clearSave(); newGame(); go('daycard'); } },
};

SCENES.over = {
  enter() { SFX.music(false); SFX.play('sad'); SFX.play('bad'); },
  update() {},
  render() {
    rect(0, 0, W - 1, H - 1, K.INK);
    rect(0, 60, W - 1, 110, K.BRICK_D);
    bigText(W / 2, 72, '已 下 架', 12, 3, K.CREAM, K.INK);
    OVER_LINES.forEach((s, i) => txt(W / 2, 140 + i * 20, s, 12, K.CREAM, 'ma'));
    drawEndStats(240);
    btnBox(RESTART_BTN, '再来一局', { size: 10, fill: C.BRICK, border: C.AMBER, hot: true });
  },
  click(x, y) { if (st() > 1.5 && inBox(x, y, RESTART_BTN)) { clearSave(); newGame(); go('daycard'); } },
};