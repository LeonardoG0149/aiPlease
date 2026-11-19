const entry = (await listTaskSpaces()).find((s) => s.name === 'ai-please game playtest');
const task = entry ? await taskSpace(entry.id) : await taskSpace('ai-please game playtest');
const page = (await task.pages()).find((p) => p.label === 'p1') ?? (await task.newPage());
const OUT = 'C:/Users/longh/ego/';
const URL0 = 'http://127.0.0.1:8123/';
if (!(await page.url()).startsWith(URL0)) await page.goto(URL0);

const wait = (sc) => page.waitForFunction((s) => window.__ready && window.__game.scene === s, sc, { timeout: 20000 });
const gstate = (fn) => page.evaluate(fn);
async function gclick(x, y, label) {
  const r = await gstate(() => {
    const b = document.getElementById('game').getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  await page.mouse.click(r.l + (x * r.w) / 640, r.t + (y * r.h) / 360, { label });
}
async function order(mode) {
  await page.evaluate((m) => {
    const g = window.__game;
    const p = m === 'good'
      ? Object.assign({}, g.question().ideal, { net: 0, verbose: 50 })
      : { base: 2, temp: 0, ctx: 0, cost: 0, persona: 5, align: 2, net: 1, verbose: 0 };
    g.setParams(p);
    g.ask();
  }, mode);
  await wait('answer');
  await page.evaluate(() => window.__game.finishAnswer());
  await wait('store');
  await page.evaluate(() => window.__game.advance());
}
async function freshStart() {
  await page.waitForTimeout(1600);
  await gclick(320, 311, 'restart button');
  await wait('daycard');
  await wait('workbench');
}
const report = {};

await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: 'window.__errs=null;window.addEventListener("error",e=>{(window.__errs=window.__errs||[]).push(String(e.message))});window.addEventListener("unhandledrejection",e=>{(window.__errs=window.__errs||[]).push(String(e.reason))});',
});
await page.cdp('Page.reload', { ignoreCache: true });
await wait('title');

report.sweep = await gstate(() => {
  let n = 0, empty = 0, minLen = 1e9, minScore = 1e9, maxScore = -1, minStars = 9, maxStars = 0;
  for (const q of QUESTIONS)
    for (let base = 0; base < 3; base++)
      for (const temp of [0, 50, 100])
        for (const ctx of [0, 50, 100])
          for (let cost = 0; cost < 3; cost++)
            for (let persona = 0; persona < 8; persona++)
              for (let align = 0; align < 3; align++)
                for (const net of [0, 1])
                  for (const verbose of [0, 50, 100]) {
                    const p = { base, temp, ctx, cost, persona, align, net, verbose };
                    const t = composeAnswer(p, q).text;
                    const s = scoreOf(p, q);
                    const st = starsOf(s);
                    n++;
                    if (!t || !t.length) empty++;
                    if (t.length < minLen) minLen = t.length;
                    if (s < minScore) minScore = s;
                    if (s > maxScore) maxScore = s;
                    if (st < minStars) minStars = st;
                    if (st > maxStars) maxStars = st;
                  }
  return { n, empty, minLen, minScore, maxScore, minStars, maxStars };
});

await page.evaluate(() => window.__game.clearSave());
await page.cdp('Page.reload', { ignoreCache: true });
await wait('title');
report.firstBoot = await gstate(() => ({ hasSave: window.__game.hasSave() }));
await gclick(320, 215, 'start new game');
await wait('intro');
await gclick(320, 180, 'skip intro');
await wait('daycard');
await wait('workbench');

const dlPromise = page.waitForEvent('download', { timeout: 15000 });
await gclick(514, 326, 'export combo card');
const dl = await dlPromise;
report.export = { filename: dl.suggestedFilename() };
await dl.saveAs(OUT + 'ai-please-card.png');

await order('good');
await wait('workbench');
await page.cdp('Page.reload', { ignoreCache: true });
await wait('title');
report.resumeTitle = await gstate(() => ({ hasSave: window.__game.hasSave() }));
await gclick(320, 252, 'continue saved game');
await wait('workbench');
report.resume = await gstate(() => ({ orderIdx: window.__game.S.orderIdx, stars: window.__game.S.stars.length, coins: window.__game.S.coins }));

for (let i = 1; i < 5; i++) {
  await order('good');
  await wait(i === 4 ? 'newspaper' : 'workbench');
}
report.day1 = await gstate(() => ({ avg: window.__game.avg(), coins: window.__game.S.coins, dayUnlocks: GAME.dayUnlocks.length, unlocked: window.__game.S.unlocked.slice() }));
await page.screenshot({ path: OUT + 'ai-please-15-newspaper-unlocks.png' });
await page.evaluate(() => window.__game.nextDay());
await wait('daycard');
await wait('workbench');

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
await page.waitForTimeout(400);
report.portraitHint = await gstate(() => getComputedStyle(document.getElementById('rotate')).display);
await page.screenshot({ path: OUT + 'ai-please-11-mobile-portrait.png' });
await page.click('text=先竖着玩');
await page.waitForTimeout(300);
report.mobileFit = await gstate(() => {
  const b = document.getElementById('game').getBoundingClientRect();
  return { w: Math.round(b.width), h: Math.round(b.height), vw: innerWidth, vh: innerHeight, fits: b.width <= innerWidth + 1 && b.height <= innerHeight + 1 };
});
await page.screenshot({ path: OUT + 'ai-please-12-mobile-play.png' });
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'ai-please-13-tablet.png' });
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'ai-please-14-desktop.png' });
await page.cdp('Emulation.clearDeviceMetricsOverride');
await page.waitForTimeout(300);

for (let i = 0; i < 50; i++) {
  const T = [
    [196, 163], [396, 163], [424, 163], [620, 163],
    [200 + ((i * 37) % 170), 201], [420 + ((i * 53) % 170), 201],
    [200, 239], [392, 239], [440, 239], [520, 239], [600, 239],
    [210, 277], [420 + ((i * 29) % 170), 277], [358, 326], [430, 326],
  ];
  const t = T[(i * 13 + 5) % T.length];
  await gclick(t[0], t[1], 'stress control click');
}
report.stress = await gstate(() => {
  const p = window.__game.params;
  const ok = p.base >= 0 && p.base <= 2 && p.temp >= 0 && p.temp <= 100 && p.ctx >= 0 && p.ctx <= 100 &&
    p.cost >= 0 && p.cost <= 2 && p.persona >= 0 && p.persona <= 7 && p.align >= 0 && p.align <= 2 &&
    (p.net === 0 || p.net === 1) && p.verbose >= 0 && p.verbose <= 100;
  return { scene: window.__game.scene, paramsInRange: ok };
});
await gclick(250, 326, 'ask rapid 1');
await gclick(250, 326, 'ask rapid 2');
await wait('answer');
await gclick(320, 160, 'skip typing 1');
await gclick(320, 160, 'skip typing 2');
await page.waitForTimeout(1200);
await gclick(527, 324, 'to store');
await wait('store');
await page.waitForTimeout(800);
await gclick(320, 160, 'store extra click 1');
await gclick(320, 160, 'store extra click 2');
await gclick(320, 311, 'advance');
await wait('workbench');
await gclick(92, 250, 'workbench extra click 1');
await gclick(92, 250, 'workbench extra click 2');
report.rapidChain = await gstate(() => ({ scene: window.__game.scene, day: window.__game.S.day, orderIdx: window.__game.S.orderIdx }));

await page.click('#mute');
const m1 = await gstate(() => document.getElementById('mute').textContent);
await page.click('#mute');
const m2 = await gstate(() => document.getElementById('mute').textContent);
report.mute = { off: m1, on: m2 };
await page.click('#full');
await page.waitForTimeout(400);
report.full = await gstate(() => ({ fs: !!document.fullscreenElement, label: document.getElementById('full').textContent }));
if (report.full.fs) {
  await page.click('#full');
  await page.waitForTimeout(300);
  report.fullAfterExit = await gstate(() => ({ fs: !!document.fullscreenElement, label: document.getElementById('full').textContent }));
}

for (let d = 2; d <= 3; d++) {
  for (let i = d === 2 ? 1 : 0; i < 5; i++) {
    await order('good');
    await wait(i === 4 ? 'newspaper' : 'workbench');
  }
  await page.evaluate(() => window.__game.nextDay());
  await wait(d === 3 ? 'ending' : 'daycard');
  if (d === 2) await wait('workbench');
}
report.ending = await gstate(() => ({ scene: window.__game.scene, stars: window.__game.S.stars.length, avg: window.__game.avg() }));

await freshStart();
await order('bad');
await wait('workbench');
await order('bad');
await wait('over');
report.fail = await gstate(() => ({ scene: window.__game.scene, avg: window.__game.avg() }));
await freshStart();
report.restart = await gstate(() => ({ day: window.__game.S.day, stars: window.__game.S.stars.length, coins: window.__game.S.coins }));
report.errs = await gstate(() => window.__errs);
console.log(JSON.stringify(report, null, 1));