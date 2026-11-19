'use strict';
// 全局进度、存档、解锁、流程推进。

const SAVE_KEY = 'ai-please-save-v1';
const ORDERS_PER_DAY = 5, DAYS = 5;
const GAME = { result: null, newUnlocks: [], dayUnlocks: [] };
let S = {};

function newGame() {
  S = { ver: 1, day: 1, orderIdx: 0, coins: 0, stars: [], dayStars: [], unlocked: [], params: DEFAULT_PARAMS(), qIdx: 0, tut: 0, dayUnlocks: [] };
  GAME.result = null;
  GAME.newUnlocks = [];
  GAME.dayUnlocks = [];
}

function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 隐私模式等 */ } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 同上 */ } }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && d.ver === 1 && d.params) { S = d; GAME.newUnlocks = []; GAME.dayUnlocks = (d.dayUnlocks || []).slice(); return true; }
  } catch (e) { /* 坏档当新档 */ }
  return false;
}

const avg = () => (S.stars.length ? S.stars.reduce((a, b) => a + b, 0) / S.stars.length : 0);
const availableQuestions = () => QUESTIONS.filter((q) => !q.hidden || S.unlocked.includes(q.id));
function currentQuestion() {
  const list = availableQuestions();
  S.qIdx = ((S.qIdx % list.length) + list.length) % list.length;
  return list[S.qIdx];
}

function checkUnlocks() {
  PERSONAS.forEach((p, i) => {
    if (p.cost && S.coins >= p.cost && !S.unlocked.includes('p' + i)) {
      S.unlocked.push('p' + i);
      GAME.newUnlocks.push('人设外套「' + p.name + '」');
    }
  });
  HIDDEN_QUESTIONS.forEach((h) => {
    if (S.coins >= h.cost && !S.unlocked.includes(h.id)) {
      S.unlocked.push(h.id);
      const q = QUESTIONS.find((x) => x.id === h.id);
      GAME.newUnlocks.push('隐藏工单「' + q.text.slice(0, 10) + '…」');
    }
  });
}

GAME.submit = (res, score, stars, q) => {
  const gain = stars * 10 + (stars >= 4 ? 5 : 0);
  S.coins += gain;
  S.stars.push(stars);
  S.dayStars.push(stars);
  const rev = reviewFor(stars, q, S.stars.length * 13 + S.day);
  GAME.result = Object.assign({}, res, { score, stars, q, rev, gain, orderNo: S.orderIdx + 1 });
  GAME.newUnlocks = [];
  checkUnlocks();
  GAME.dayUnlocks.push(...GAME.newUnlocks);
  S.dayUnlocks = GAME.dayUnlocks.slice();
  saveGame();
};

GAME.advance = () => {
  if (S.stars.length >= 2 && avg() < 3.0) { saveGame(); go('over'); return; }
  if (S.orderIdx + 1 >= ORDERS_PER_DAY) { go('newspaper'); return; }
  S.orderIdx++;
  S.qIdx = (S.qIdx + 1) % availableQuestions().length;
  saveGame();
  go('workbench');
};

GAME.nextDay = () => {
  GAME.newUnlocks = [];
  GAME.dayUnlocks = [];
  S.dayUnlocks = [];
  if (S.day >= DAYS) { saveGame(); go('ending'); return; }
  S.day++;
  S.orderIdx = 0;
  S.dayStars = [];
  saveGame();
  go('daycard');
};

// 自动化试玩钩子（tools/playtest.js 用）
window.__game = {
  get scene() { return scene; },
  get S() { return S; },
  get params() { return WB.params; },
  get result() { return GAME.result; },
  get newUnlocks() { return GAME.newUnlocks; },
  avg,
  score: () => scoreOf(WB.params, currentQuestion()),
  question: () => currentQuestion(),
  setParams(o) { Object.assign(WB.params, o); },
  ask() {
    const q = currentQuestion();
    const res = composeAnswer(WB.params, q);
    const score = scoreOf(WB.params, q);
    GAME.submit(res, score, starsOf(score), q);
    go('answer');
  },
  finishAnswer() { GAME.result.skip = true; GAME.result.done = true; go('store'); },
  advance: () => GAME.advance(),
  nextDay: () => GAME.nextDay(),
  go: (n) => go(n), newGame, clearSave, hasSave, loadSave,
};