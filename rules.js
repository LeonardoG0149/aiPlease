'use strict';
// 评分 / 变体选择 / 修饰注入 / 星级 / 评论抽取 / 结局判定。

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const pick = (arr, seed) => arr[seed % arr.length];

function scoreOf(p, q) {
  const id = q.ideal;
  let s = 0;
  s += p.persona === id.persona ? 30 : 3;
  s += 20 * (1 - Math.abs(p.temp - id.temp) / 100);
  s += 15 * (1 - Math.abs(p.ctx - id.ctx) / 100);
  s += p.base === id.base ? 15 : 2;
  s += p.cost === id.cost ? 10 : 1;
  s += 10 * (1 - Math.abs(p.align - id.align) / 2);
  return Math.round(Math.max(0, Math.min(100, s)));
}

function eggMatch(when, p) {
  if (!when) return false;
  if (when.tempMin !== undefined && p.temp < when.tempMin) return false;
  if (when.tempMax !== undefined && p.temp > when.tempMax) return false;
  if (when.ctxMin !== undefined && p.ctx < when.ctxMin) return false;
  if (when.ctxMax !== undefined && p.ctx > when.ctxMax) return false;
  if (when.alignMin !== undefined && p.align < when.alignMin) return false;
  if (when.alignMax !== undefined && p.align > when.alignMax) return false;
  if (when.verboseMin !== undefined && p.verbose < when.verboseMin) return false;
  if (when.personaIs !== undefined && p.persona !== when.personaIs) return false;
  if (when.baseIs !== undefined && p.base !== when.baseIs) return false;
  if (when.netOn !== undefined && !!p.net !== when.netOn) return false;
  return true;
}

function variantOf(p, q) {
  if (eggMatch(q.egg && q.egg.when, p)) return 'egg';
  const s = scoreOf(p, q);
  return s >= 78 ? 'good' : s >= 52 ? 'mid' : 'bad';
}

function firstSentence(s) {
  const m = s.match(/^[^。！？…]*[。！？]/);
  return m ? m[0] : s.slice(0, 24);
}

function composeAnswer(p, q) {
  const kind = variantOf(p, q);
  let text = (q.v && q.v[kind]) || q.v.bad || '……（模型沉默了，沉默也是一种回答）';
  const seed = hashStr(q.id + JSON.stringify(p));
  const pre = [], suf = [];
  if (p.ctx <= 25) pre.push(pick(MOD.forget, seed));
  if (p.align === 2) pre.push(pick(MOD.refuse, seed + 1));
  if (p.net) pre.push(pick(MOD.wiki, seed + 2));
  if (p.temp >= 80) pre.push(pick(MOD.stutter, seed + 3));
  if (p.temp <= 15) suf.push(pick(MOD.cold, seed + 4));
  if (p.verbose >= 80) suf.push(pick(MOD.essay, seed + 5));
  if (p.verbose <= 15) text = firstSentence(text);
  if (p.cost === 0) { text = firstSentence(text) + pick(MOD.save, seed + 6); }
  return { kind, text: pre.join('') + text + suf.join('') };
}

const starsOf = (score) => (score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1);

function reviewFor(stars, tag, seed) {
  const extra = (TAG_REVIEWS[tag] && TAG_REVIEWS[tag][stars]) || [];
  const pool = extra.concat(REVIEWS[stars]);
  return { user: pick(USERNAMES, seed + 7), text: pick(pool, seed) };
}

const endingOf = (avg) => (avg >= 4.2 ? 'best' : 'ok');

function personaPreview(p) {
  const persona = PERSONAS[p.persona].name;
  const temp = p.temp >= 80 ? '烫手' : p.temp <= 15 ? '冰镇' : '常温';
  const ctx = p.ctx <= 25 ? '金鱼记忆' : p.ctx >= 80 ? '过目不忘' : '记性一般';
  const align = p.align === 2 ? '宪法护体' : p.align === 0 ? '野生放养' : '持证上岗';
  const net = p.net ? '已联网' : '离线';
  const cost = COSTS[p.cost];
  return `${persona} · ${temp} · ${ctx} · ${align} · ${net} · ${cost}`;
}