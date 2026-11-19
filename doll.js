'use strict';
// AI 娃娃分层绘制：底座体型 × 人设外套 × 温度围巾 × 上下文背包/眼镜 × 成本徽章 × 对齐宪法 × 联网天线 × 话痨气泡。

function drawDoll(cx, fy, p, t, expr = 'idle') {
  const bw = p.base === 1 ? 30 : p.base === 2 ? 24 : 22;
  const bh = p.base === 1 ? 34 : p.base === 2 ? 28 : 26;
  const jit = p.temp >= 80 ? Math.round(Math.sin(t * 30)) : 0;
  const x = cx + jit, y = fy;
  const coat = PERSONAS[p.persona].coat;
  const coatK = rgb(coat), coatD = rgb(coat.map((v) => Math.max(0, v - 45)));
  rect(cx - bw / 2 - 2, y + 1, cx + bw / 2 + 2, y + 1, K.DESK_D);
  // 上下文背包
  const bp = 3 + Math.round(p.ctx / 25);
  rect(x - bw / 2 - bp, y - bh + 4, x - bw / 2 - 1, y - 8, K.BOOK);
  outline(x - bw / 2 - bp, y - bh + 4, x - bw / 2 - 1, y - 8, K.BOOK_L);
  // 腿
  rect(x - 6, y - 6, x - 2, y, K.OUTLINE);
  rect(x + 2, y - 6, x + 6, y, K.OUTLINE);
  // 身体外套
  rect(x - bw / 2, y - bh, x + bw / 2, y - 6, coatK);
  outline(x - bw / 2, y - bh, x + bw / 2, y - 6, coatD);
  if (p.persona === 0) for (let i = 0; i < 3; i++) pt(x, y - bh + 6 + i * 6, K.CREAM);
  if (p.persona === 1) { line(x - bw / 2 + 2, y - bh + 8, x + bw / 2 - 2, y - bh + 12, coatD); line(x - bw / 2 + 2, y - bh + 12, x + bw / 2 - 2, y - bh + 8, coatD); }
  if (p.persona === 2) { pt(x - 3, y - bh + 7, K.RED_L); pt(x + 3, y - bh + 7, K.RED_L); rect(x - 1, y - bh + 9, x + 1, y - bh + 11, K.RED_L); }
  if (p.persona === 3) { rect(x - 4, y - bh + 6, x + 4, y - bh + 8, K.SLATE_L); pt(x + 4, y - bh + 5, K.CREAM); }
  if (p.persona === 4) for (let i = 0; i < 5; i++) pt(x - 6 + ((i * 5 + Math.floor(t * 6)) % 12), y - bh + 5 + (i % 3) * 6, K.BRICK);
  if (p.persona === 5) for (let i = 0; i < 4; i++) rect(x - 6, y - bh + 5 + i * 5, x + 6, y - bh + 5 + i * 5, K.GREY_D);
  if (p.persona === 6) { rect(x - 5, y - bh + 5, x + 5, y - bh + 13, K.GOLD); txt(x, y - bh + 6, '判', 8, K.NAVY, 'ma'); }
  if (p.persona === 7) { txt(x, y - bh + 6, '废话', 8, K.GREY_D, 'ma'); txt(x, y - bh + 15, '文学', 8, K.GREY_D, 'ma'); }
  // 成本徽章
  if (p.cost === 0) { rect(x - bw / 2 + 2, y - 14, x - bw / 2 + 8, y - 8, K.DESK_L); outline(x - bw / 2 + 2, y - 14, x - bw / 2 + 8, y - 8, K.DESK_D); }
  if (p.cost === 1) { rect(x - 1, y - bh + 3, x + 1, y - bh + 12, K.NAVY); pt(x, y - bh + 13, K.NAVY_L); }
  if (p.cost === 2) { for (let i = 0; i < 5; i++) pt(x - 6 + i * 3, y - bh + 4 + (i % 2), K.GOLD); }
  // 温度围巾
  const u = p.temp / 100;
  const sc = rgb([Math.round(lerp(86, 222, u)), Math.round(lerp(102, 92, u)), Math.round(lerp(132, 76, u))]);
  rect(x - bw / 2 + 1, y - bh - 2, x + bw / 2 - 1, y - bh + 2, sc);
  rect(x + bw / 2 - 4, y - bh + 2, x + bw / 2 - 2, y - bh + 8, sc);
  // 头
  const hw = p.base === 1 ? 16 : 14;
  const hy = y - bh - 14;
  rect(x - hw / 2, hy, x + hw / 2, y - bh - 2, K.SKIN);
  outline(x - hw / 2, hy, x + hw / 2, y - bh - 2, K.OUTLINE);
  rect(x - hw / 2, hy, x + hw / 2, hy + 2, K.OUTLINE);
  // 眼睛
  const ey = hy + 5;
  if (p.temp >= 80) {
    const o = Math.floor(t * 10) % 2;
    pt(x - 4 + o, ey, K.RED); pt(x - 3 - o, ey + 1, K.RED);
    pt(x + 3 + o, ey, K.RED); pt(x + 4 - o, ey + 1, K.RED);
  } else if (p.temp <= 15) {
    rect(x - 5, ey, x - 2, ey, K.INK); rect(x + 2, ey, x + 5, ey, K.INK);
  } else {
    rect(x - 4, ey, x - 3, ey + 1, K.INK); rect(x + 3, ey, x + 4, ey + 1, K.INK);
  }
  // 嘴（表情）
  const my = hy + 9;
  if (expr === 'talk') rect(x - 1, my, x + 1, my + 2, K.INK);
  else if (expr === 'happy') { rect(x - 3, my, x + 3, my, K.INK); pt(x - 4, my - 1, K.INK); pt(x + 4, my - 1, K.INK); }
  else if (expr === 'sad') { rect(x - 3, my + 1, x + 3, my + 1, K.INK); pt(x - 4, my + 2, K.INK); pt(x + 4, my + 2, K.INK); }
  else if (expr === 'shock') rect(x - 1, my, x + 1, my + 2, K.INK);
  else rect(x - 2, my, x + 2, my, K.INK);
  if (p.temp >= 80) { pt(x - 6, my - 1, K.PINK_D); pt(x + 6, my - 1, K.PINK_D); }
  // 上下文眼镜
  if (p.ctx >= 60) {
    outline(x - 6, ey - 1, x - 1, ey + 3, K.METAL_L);
    outline(x + 1, ey - 1, x + 6, ey + 3, K.METAL_L);
    rect(x - 1, ey, x + 1, ey, K.METAL_L);
  }
  // 联网天线
  if (p.net) {
    line(x, hy, x, hy - 6, K.METAL);
    pt(x, hy - 7, Math.floor(t * 3) % 2 ? K.AMBER : K.RED);
  }
  // 氪金皇冠
  if (p.cost === 2) {
    rect(x - 5, hy - 4, x + 5, hy - 2, K.GOLD);
    pt(x - 5, hy - 5, K.GOLD); pt(x, hy - 6, K.GOLD); pt(x + 5, hy - 5, K.GOLD);
  }
  // 对齐宪法书
  const bk = 2 + p.align * 3;
  rect(x + bw / 2 + 1, y - bh + 6, x + bw / 2 + 1 + bk, y - 8, K.BOOK);
  outline(x + bw / 2 + 1, y - bh + 6, x + bw / 2 + 1 + bk, y - 8, K.BOOK_L);
  if (p.align === 2) spark(x + bw / 2 + 2 + bk / 2, y - bh + 2, K.GOLD, false);
  // 话痨气泡
  if (p.verbose >= 60) {
    const bx = x + bw / 2 + 6, by = hy - 8;
    rect(bx, by, bx + 16, by + 9, K.CREAM);
    outline(bx, by, bx + 16, by + 9, K.GREY_D);
    const dots = p.verbose >= 85 ? 3 : 2;
    for (let i = 0; i < dots; i++) pt(bx + 4 + i * 4, by + 4, K.GREY_D);
  }
}

function drawDollHead(cx, cy, p, t) {
  const coat = rgb(PERSONAS[p.persona].coat);
  rect(cx - 7, cy + 5, cx + 7, cy + 8, coat);
  rect(cx - 6, cy - 7, cx + 6, cy + 5, K.SKIN);
  outline(cx - 6, cy - 7, cx + 6, cy + 5, K.OUTLINE);
  rect(cx - 6, cy - 7, cx + 6, cy - 5, K.OUTLINE);
  const ey = cy - 2;
  if (p.temp >= 80) { pt(cx - 3, ey, K.RED); pt(cx + 3, ey, K.RED); }
  else { rect(cx - 3, ey, cx - 2, ey + 1, K.INK); rect(cx + 2, ey, cx + 3, ey + 1, K.INK); }
  rect(cx - 2, cy + 2, cx + 2, cy + 2, K.INK);
  if (p.net) { line(cx, cy - 7, cx, cy - 11, K.METAL); pt(cx, cy - 12, K.AMBER); }
  if (p.cost === 2) { rect(cx - 4, cy - 10, cx + 4, cy - 8, K.GOLD); pt(cx, cy - 11, K.GOLD); }
}