'use strict';
// 音效和配乐：移植自 pp/audio.py，全部在浏览器里现场合成，不加载任何音频文件。

const SFX = (() => {
  const SR = 44100;
  let ac = null, master = null, ambGain = null, ambSrc = null, musGain = null, musSrc = null, muted = false;
  const cache = new Map();

  const N = (d) => Math.max(1, Math.floor(d * SR));

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0 || 1;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noise(n, seed) {
    const r = rng(seed + 7), x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = (r() + r() + r() + r() - 2) * 1.7;
    return x;
  }

  // 二阶 Butterworth（RBJ biquad）；带通 = 高通 + 低通 串联
  function biquad(x, type, f) {
    f = Math.min(f, SR * 0.45);
    const w0 = 2 * Math.PI * f / SR, cs = Math.cos(w0), al = Math.sin(w0) / (2 * Math.SQRT1_2);
    let b0, b1, b2;
    if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const xi = x[i];
      const yi = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = xi; y2 = y1; y1 = yi; y[i] = yi;
    }
    return y;
  }

  function filt(x, kind, f) {
    if (kind === 'bandpass') return biquad(biquad(x, 'highpass', f[0]), 'lowpass', f[1]);
    return biquad(x, kind, f);
  }

  const lin = (a, b, n) => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = a + (b - a) * i / Math.max(1, n - 1); return x; };

  function phase(freq, n) {
    const p = new Float32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += (typeof freq === 'number' ? freq : freq[i]); p[i] = 2 * Math.PI * acc / SR; }
    return p;
  }

  function square(freq, n, duty = 0.5) {
    const p = phase(freq, n), x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = ((p[i] / (2 * Math.PI)) % 1) < duty ? 1 : -1;
    return x;
  }

  function tri(freq, n) {
    const p = phase(freq, n), x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = 4 * Math.abs(((p[i] / (2 * Math.PI)) % 1) - 0.5) - 1;
    return x;
  }

  function sine(freq, n) { const p = phase(freq, n); return p.map(Math.sin); }

  function decay(n, tau) { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = Math.exp(-i / (tau * SR)); return x; }

  const mul = (a, b) => { const x = new Float32Array(a.length); for (let i = 0; i < a.length; i++) x[i] = a[i] * (typeof b === 'number' ? b : b[i]); return x; };
  const add = (a, b, g = 1) => { const x = new Float32Array(a.length); for (let i = 0; i < a.length; i++) x[i] = a[i] + (i < b.length ? b[i] * g : 0); return x; };

  function fade(x, a = 0.004, r = 0.02) {
    const n = x.length, y = new Float32Array(n), A = Math.max(1, a * SR), R = Math.max(1, r * SR);
    for (let i = 0; i < n; i++) y[i] = x[i] * Math.min(1, i / A) * Math.min(1, (n - i) / R);
    return y;
  }

  function norm(x, peak = 1) {
    let m = 0;
    for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
    return m > 0 ? mul(x, peak / m) : x;
  }

  function cat(...parts) {
    const n = parts.reduce((s, p) => s + p.length, 0), x = new Float32Array(n);
    let o = 0;
    for (const p of parts) { x.set(p, o); o += p.length; }
    return x;
  }

  function place(out, t, x, g = 1) {
    const p = N(t);
    for (let i = 0; i < x.length && p + i < out.length; i++) out[p + i] += x[i] * g;
  }

  // ———————————————— 人声 / 环境 ————————————————

  function mumble(dur, pitch, seed, peak = 0.3) {
    const r = rng(seed * 31 + 5), out = new Float32Array(N(dur));
    const uni = (a, b) => a + (b - a) * r();
    let pos = 0;
    while (pos < out.length) {
      const n = Math.min(N(uni(0.06, 0.12)), out.length - pos);
      if (n < 64) break;
      const f0 = pitch * uni(0.85, 1.2);
      const glide = lin(f0, f0 * uni(0.85, 1.1), n);
      const p = phase(glide, n), saw = new Float32Array(n);
      for (let i = 0; i < n; i++) saw[i] = ((p[i] / (2 * Math.PI)) % 1) * 2 - 1;
      const f1 = uni(450, 850), f2 = uni(1100, 2200);
      const v = add(filt(saw, 'bandpass', [f1 * 0.7, f1 * 1.3]), filt(saw, 'bandpass', [f2 * 0.8, f2 * 1.2]), 0.6);
      out.set(fade(v, 0.012, 0.03).map((s, i) => s + out[pos + i]), pos);
      pos += n + N(uni(0.015, 0.05));
    }
    return norm(filt(out, 'lowpass', 3500), peak);
  }

  function ambient() {
    const n = N(8);
    const wind = mul(filt(noise(n, 1), 'lowpass', 380), 3);
    const crowd = filt(noise(n, 2), 'bandpass', [220, 900]);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      crowd[i] *= 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t) * Math.sin(2 * Math.PI * 0.125 * t + 1);
    }
    return fade(norm(add(wind, crowd, 0.6), 0.06), 0.3, 0.3);
  }

  function intercom() {
    const n = N(0.5);
    let v = cat(new Float32Array(N(0.04)), mumble(0.42, 150, 11, 1.0), new Float32Array(n)).slice(0, n);
    v = filt(add(v, noise(n, 12), 0.08), 'bandpass', [350, 2600]).map((s) => Math.tanh(s * 4));
    const ck = noise(N(0.006), 13);
    return norm(add(v, ck, 0.5), 0.4);
  }

  // ———————————————— 桌面音效 ————————————————

  function footstep(seed) {
    const n = N(0.06);
    let x = mul(filt(noise(n, seed), 'lowpass', 900), decay(n, 0.012));
    x = add(x, mul(sine(90, n), decay(n, 0.02)), 0.6);
    return norm(x, 0.16);
  }

  function paper(seed = 0) {
    const n = N(0.18), r = rng(seed + 100);
    const x = filt(noise(n, seed + 100), 'bandpass', [1800, 7000]);
    const crinkle = new Float32Array(n);
    for (let i = 0; i < n; i++) crinkle[i] = r() < 0.02 ? 0.5 + r() : 0;
    const cr = filt(crinkle, 'lowpass', 300);
    for (let i = 0; i < n; i++) x[i] *= (0.6 + cr[i] * 8) * Math.min(1, i / N(0.02)) * Math.exp(-i / (0.05 * SR));
    return norm(x, 0.2);
  }

  function thud() {
    const n = N(0.25);
    let x = mul(sine(lin(120, 60, n), n), decay(n, 0.05));
    x = add(x, mul(filt(noise(n, 81), 'lowpass', 1200), decay(n, 0.01)));
    return add(norm(x, 0.45), paper(9), 0.6);
  }

  function click() {
    const n = N(0.012);
    let x = mul(filt(noise(n, 21), 'highpass', 2000), decay(n, 0.002));
    x = add(x, mul(sine(2200, n), decay(n, 0.003)));
    return norm(x, 0.18);
  }

  const beep2 = (f1, d1, f2, d2, peak, dec) => {
    const a = square(f1, N(d1));
    let b = square(f2, N(d2));
    if (dec) b = mul(b, decay(b.length, dec));
    return norm(filt(fade(cat(a, b)), 'lowpass', 2500), peak);
  };

  function discrepancy() {
    const n1 = N(0.12), n2 = N(0.4);
    const a = mul(add(square(110, n1), square(155.6, n1)), 0.5);
    const b = mul(mul(add(square(98, n2), square(138.6, n2)), 0.5), decay(n2, 0.15));
    return norm(filt(fade(cat(a, b)), 'lowpass', 1400), 0.26);
  }

  function tray(reverse) {
    const n = N(0.26), m = N(0.09);
    const sweep = filt(noise(n, 31), 'bandpass', [300, 2400]);
    for (let i = 0; i < n; i++) sweep[i] *= Math.sin(Math.PI * i / n) * 0.7;
    let clunk = mul(add(sine(220, m), sine(331, m), 0.6), decay(m, 0.02));
    clunk = add(clunk, mul(filt(noise(m, 32), 'lowpass', 1500), decay(m, 0.01)));
    return norm(cat(sweep, clunk), reverse ? 0.18 : 0.26);
  }

  function stamp(kind) {
    const n = N(0.4);
    const f = kind === 'approve' ? lin(110, 50, n) : lin(95, 42, n);
    const th = mul(sine(f, n), decay(n, 0.09));
    const hit = mul(filt(noise(n, 41), 'lowpass', 1600), decay(n, 0.012));
    const chk = mul(filt(noise(n, 42), 'bandpass', [2000, 6000]), decay(n, 0.006));
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.tanh((th[i] + hit[i] * 0.8 + chk[i] * 0.4) * 1.5);
    return norm(x, 0.85);
  }

  function detainBtn() {
    const n = N(0.3);
    const gate = square(8, n);
    const x = mul(mul(square(220, n), gate.map((g) => (g > 0 ? 1 : 0))), decay(n, 0.2));
    return norm(filt(x, 'lowpass', 1800), 0.2);
  }

  function scuffle() {
    const out = new Float32Array(N(1.2)), r = rng(91);
    for (let i = 0; i < 10; i++) place(out, i * 0.1 + r() * 0.03, footstep(60 + (i % 6)), 0.8 + r() * 0.6);
    place(out, 0.35, mumble(0.35, 95, 92, 0.25));
    return out;
  }

  function printer(dur) {
    const n = N(dur), x = new Float32Array(n);
    const buzz = filt(square(55, n), 'lowpass', 900), tk = filt(noise(n, 71), 'bandpass', [1500, 5000]);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      x[i] = buzz[i] * (0.5 + 0.5 * Math.sign(Math.sin(2 * Math.PI * 14 * t))) * 0.6 +
        tk[i] * (Math.sin(2 * Math.PI * 28 * t) > 0.8 ? 0.5 : 0);
    }
    return norm(fade(x, 0.01, 0.05), 0.16);
  }

  function typekey(seed) {
    const n = N(0.03);
    return norm(mul(filt(noise(n, 300 + seed), 'bandpass', [1200, 5000]), decay(n, 0.004)), 0.12);
  }

  function whoosh() {
    const n = N(0.3), x = filt(noise(n, 88), 'bandpass', [400, 3000]);
    for (let i = 0; i < n; i++) x[i] *= Math.sin(Math.PI * i / n) ** 2;
    return norm(x, 0.2);
  }

  function crowdFight(dur) {
    const out = new Float32Array(N(dur)), r = rng(77);
    for (let i = 0; i < Math.floor(dur * 6); i++) place(out, r() * (dur - 0.3), mumble(0.25, 110 + r() * 110, 400 + i, 0.25));
    return norm(out, 0.3);
  }

  function bell() {
    const n = N(1.6);
    let x = new Float32Array(n);
    for (const [f, g] of [[880, 1], [1320, 0.5], [2200, 0.25]]) x = add(x, mul(sine(f, n), decay(n, 0.5)), g);
    return norm(x, 0.25);
  }

  function gunshot() {
    const n = N(0.5), sh = N(0.11);
    const crack = mul(filt(noise(n, 61), 'lowpass', 4000), decay(n, 0.02));
    const boom = mul(sine(lin(90, 40, n), n), decay(n, 0.12));
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.tanh((crack[i] + boom[i] + (i >= sh ? crack[i - sh] * 0.25 : 0)) * 2);
    return norm(x, 0.7);
  }

  function siren(dur) {
    const n = N(dur), f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = 620 + (Math.sin(2 * Math.PI * 0.9 * i / SR) > 0 ? 260 : 0);
    return norm(fade(filt(square(f, n, 0.4), 'lowpass', 2200), 0.05, 0.2), 0.16);
  }

  function glitch() {
    const n = N(0.6), x = new Float32Array(n), r = rng(55);
    for (let k = 0; k < 14; k++) {
      const p = Math.floor(r() * (n - 2000)), m = 400 + Math.floor(r() * 1600);
      const sq = square(200 + r() * 1800, m), g = 0.3 + r() * 0.7;
      for (let i = 0; i < m; i++) x[p + i] += sq[i] * g;
    }
    return norm(x, 0.25);
  }

  function xray() {
    const n = N(0.8), m = N(0.06);
    const a = sine(lin(80, 160, n), n), b = sine(lin(160, 320, n), n), beep = square(1320, m);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = (a[i] + 0.5 * b[i]) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 9 * i / SR)) + (i >= n - m ? beep[i - n + m] * 0.5 : 0);
    }
    return norm(fade(x, 0.05, 0.05), 0.18);
  }

  // ———————————————— 配乐（原创苏式小调进行曲） ————————————————

  const mf = (m) => 440 * 2 ** ((m - 69) / 12);
  // 轻快店铺小调（C 大调，替换原苏式进行曲）
  // 电子风格店铺曲：俏皮合成器语汇（弹跳_sub贝斯/八分琶音/铃铛点缀），旋律原创
  const CH2 = [
    [36, [60, 64, 67, 72]], [36, [60, 64, 67, 72]], [33, [57, 60, 64, 69]], [33, [57, 60, 64, 69]],
    [41, [53, 57, 60, 65]], [41, [53, 57, 60, 65]], [43, [55, 59, 62, 67]], [43, [55, 59, 62, 67]],
    [33, [57, 60, 64, 72]], [41, [53, 57, 60, 69]], [36, [60, 64, 67, 76]], [43, [55, 59, 62, 74]],
    [33, [57, 60, 64, 72]], [41, [53, 57, 60, 69]], [38, [50, 53, 57, 62]], [43, [55, 59, 62, 67]],
    [36, [60, 64, 67, 72]], [36, [60, 64, 67, 72]], [33, [57, 60, 64, 69]], [33, [57, 60, 64, 69]],
    [41, [53, 57, 60, 65]], [41, [53, 57, 60, 65]], [43, [55, 59, 62, 67]], [43, [55, 59, 62, 67]],
  ];
  const MELO2 = [
    [[72, .5], [72, .5], [74, .5], [76, .5], [79, 1], [76, 1]],
    [[77, 1], [76, .5], [74, .5], [72, 2]],
    [[69, .5], [72, .5], [76, .5], [72, .5], [69, 1], [64, 1]],
    [[65, 1.5], [64, .5], [60, 2]],
    [[65, .5], [69, .5], [72, .5], [74, .5], [72, 1], [69, 1]],
    [[70, 1], [69, .5], [67, .5], [65, 2]],
    [[67, .5], [71, .5], [74, .5], [71, .5], [67, 1], [62, 1]],
    [[62, 1], [60, .5], [59, .5], [60, 2]],
    [[76, 2], [72, 1], [69, 1]],
    [[72, 2], [69, 1], [65, 1]],
    [[74, 2], [71, 1], [67, 1]],
    [[71, 2], [67, 1], [62, 1]],
    [[72, 1.5], [74, .5], [76, 2]],
    [[77, 1.5], [76, .5], [72, 2]],
    [[74, 1], [72, .5], [69, .5], [65, 2]],
    [[67, 1.5], [69, .5], [71, 2]],
    [[72, .5], [72, .5], [74, .5], [76, .5], [79, 1], [84, 1]],
    [[81, 1], [79, .5], [77, .5], [76, 2]],
    [[69, .5], [72, .5], [76, .5], [72, .5], [81, 1], [76, 1]],
    [[77, 1.5], [76, .5], [72, 2]],
    [[65, .5], [69, .5], [72, .5], [74, .5], [77, 1], [74, 1]],
    [[75, 1], [74, .5], [72, .5], [70, 2]],
    [[74, .5], [71, .5], [67, .5], [71, .5], [74, 1], [79, 1]],
    [[76, 1], [74, .5], [72, .5], [71, 2]],
  ];

  function lead(m, dur) {
    const n = N(dur), f = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; f[i] = mf(m) * (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.25)); }
    const a = square(f, n, 0.25), b = square(f.map((v) => v * 1.003), n), c = sine(f.map((v) => v / 2), n);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      x[i] = (a[i] * 0.6 + b[i] * 0.4 + c[i] * 0.3) * Math.min(1, t / 0.012) * (0.75 + 0.25 * Math.exp(-t / 0.08));
    }
    return filt(fade(x, 0.005, 0.05), 'lowpass', 2600);
  }

  const bass = (m, dur) => fade(mul(tri(mf(m), N(dur)), decay(N(dur), 0.35)), 0.004, 0.04);

  function pad(chord, dur) {
    const n = N(dur);
    let x = new Float32Array(n);
    for (const m of chord) x = add(x, square(mf(m - 12), n), 1 / chord.length);
    for (let i = 0; i < n; i++) x[i] *= Math.min(1, i / SR / 0.15);
    return filt(fade(x, 0.02, 0.2), 'lowpass', 900);
  }

  const kick = () => { const n = N(0.3); return mul(sine(lin(75, 45, n), n), decay(n, 0.09)); };

  function pluck(m, dur, tau = 0.09) {
    const n = N(dur);
    const x = add(square(mf(m), n, 0.35), square(mf(m) * 1.005, n, 0.35), 0.7);
    return filt(fade(mul(x, decay(n, tau)), 0.002, 0.03), 'lowpass', 3200);
  }

  const sub2 = (m, dur) => fade(mul(add(sine(mf(m), N(dur)), tri(mf(m) * 2, N(dur)), 0.3), decay(N(dur), 0.18)), 0.004, 0.04);

  function pad2(chord, dur) {
    const n = N(dur);
    let x = new Float32Array(n);
    for (const m of chord) x = add(x, add(square(mf(m - 12) * 0.994, n), square(mf(m - 12) * 1.006, n), 1), 1 / (chord.length * 2));
    return filt(fade(x, 0.05, 0.3), 'lowpass', 1100);
  }

  const hat = (open, seed) => mul(filt(noise(N(open ? 0.12 : 0.045), seed), 'highpass', 6500), decay(N(open ? 0.12 : 0.045), open ? 0.05 : 0.015));
  const clap = (seed) => mul(filt(noise(N(0.09), seed), 'bandpass', [1200, 4500]), decay(N(0.09), 0.035));
  const glint = (m, dur) => fade(mul(add(sine(mf(m), N(dur)), sine(mf(m) * 2.01, N(dur)), 0.4), decay(N(dur), 0.35)), 0.002, 0.05);

  function groove(bars, bpm = 126, drums = true, tail = 0.6) {
    const beat = 60 / bpm, bar = 4 * beat;
    const out = new Float32Array(N(bars.length * bar + tail));
    bars.forEach((b, bi) => {
      const t0 = bi * bar;
      const zen = b >= 8 && b < 16;
      const [root, tones] = CH2[b];
      let tt = t0;
      for (const [m, beats] of MELO2[b]) {
        if (m) place(out, tt, pluck(m, beats * beat * 0.95, Math.min(0.35, beats * beat * 0.5)), zen ? 0.22 : 0.3);
        tt += beats * beat;
      }
      const steps = zen ? [0, 2, 1, 3] : [0, 1, 2, 3, 2, 1, 0, 1];
      steps.forEach((ti, k) => place(out, t0 + k * (zen ? beat : beat / 2), pluck(tones[ti] + 12, zen ? 0.5 : 0.22, zen ? 0.2 : 0.07), zen ? 0.07 : 0.1));
      [[0, 0.9, 0], [1.5, 0.4, 12], [2, 0.9, 0], [3.5, 0.4, 12]].forEach(([bt, du, oct]) => place(out, t0 + bt * beat, sub2(root + oct, du * beat), zen ? (oct ? 0.07 : 0.12) : (oct ? 0.14 : 0.24)));
      place(out, t0, pad2(tones, bar), zen ? 0.04 : 0.06);
      if (drums && !zen) {
        for (let k = 0; k < 4; k++) {
          if (k % 2 === 0) place(out, t0 + k * beat, kick(), 0.45);
          else place(out, t0 + k * beat, clap(bi * 4 + k), 0.16);
        }
        for (let k = 0; k < 8; k++) place(out, t0 + k * beat / 2, hat(k === 6, bi * 8 + k), k % 2 ? 0.07 : 0.045);
      } else if (drums) {
        for (let k = 0; k < 4; k++) place(out, t0 + k * beat, hat(false, bi * 4 + k), 0.035);
      }
      if (b % 4 === 3) {
        const r = rng(b * 17 + 3);
        place(out, t0 + 3.5 * beat, glint([84, 86, 88, 91, 93][Math.floor(r() * 5)], 0.8), 0.12);
      }
      if (drums && (b === 7 || b === 15 || b === 23)) for (let r = 0; r < 4; r++) place(out, t0 + 3 * beat + r * beat / 4, clap(90 + r), 0.08 + 0.03 * r);
    });
    return norm(out, 0.6);
  }

  function dayHit() {
    const out = new Float32Array(N(1.6));
    for (let r = 0; r < 10; r++) place(out, r * 0.05, kick(), 0.15 + r * 0.03);
    place(out, 0.55, kick(), 1);
    place(out, 0.55, pad([62, 65, 69], 0.9), 0.35);
    return norm(out, 0.5);
  }

  // 全片唯一一次正经放行：D 大调号角
  function fanfare() {
    const beat = 0.5, out = new Float32Array(N(3.6));
    [[62, 0.5], [66, 0.5], [69, 0.5], [74, 2.5]].forEach(([m, b], i) => {
      place(out, i * 0.25, lead(m, b * beat), 0.4);
      place(out, i * 0.25, kick(), 0.4);
    });
    place(out, 0.75, pad([62, 66, 69, 74], 2.6), 0.18);
    place(out, 0.75, bass(38, 2.0), 0.4);
    return norm(out, 0.6);
  }

  // 低音嗡鸣 + 心跳
  function tension(dur) {
    const n = N(dur);
    const drone = filt(add(mul(square(mf(26), n), 0.5), square(mf(33) * 1.002, n), 0.4), 'lowpass', 300);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = drone[i] * Math.min(1, i / SR / 1.5) * 0.5;
    for (let k = 0; k < dur - 0.3; k += 0.8) { place(out, k, kick(), 0.6); place(out, k + 0.2, kick(), 0.4); }
    return norm(fade(out, 0.1, 0.4), 0.35);
  }

  const MAKERS = {
    gunshot, glitch, fanfare, xray,
    siren: () => siren(9), siren_short: () => siren(2.4), tension: () => tension(24),
    click, thud, intercom, discrepancy, scuffle, whoosh, bell, detain: detainBtn,
    inspect_on: () => beep2(330, 0.06, 495, 0.09, 0.13),
    inspect_off: () => beep2(495, 0.05, 330, 0.07, 0.09),
    select: () => norm(filt(fade(square(880, N(0.04))), 'lowpass', 3000), 0.1),
    citation: () => beep2(330, 0.15, 247, 0.3, 0.22, 0.12),
    tray: () => tray(false), tray_back: () => tray(true),
    stamp_deny: () => stamp('deny'), stamp_approve: () => stamp('approve'),
    title: () => groove([0, 1, 2, 3], 126, true, 1.2),
    end: () => groove([16, 17, 18, 19, 20, 21, 22, 23], 126, true, 1.5),
    sad: () => norm(groove([8, 9, 10, 11], 84, false, 2.0), 0.4),
    day_hit: dayHit,
    fight: () => crowdFight(3.0),
    star: () => beep2(880, 0.06, 1318, 0.14, 0.2, 0.1),
    bad: () => beep2(196, 0.16, 98, 0.34, 0.26, 0.14),
    coin: () => norm(filt(fade(cat(square(988, N(0.05)), square(1319, N(0.12)))), 'lowpass', 4000), 0.2),
    unlock: () => fanfare(),
    shop: () => groove([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], 126, true, 0.6),
  };

  function buffer(name, make) {
    if (cache.has(name)) return cache.get(name);
    const data = make ? make() : MAKERS[name]();
    const b = ac.createBuffer(1, data.length, SR);
    b.copyToChannel(data, 0);
    cache.set(name, b);
    return b;
  }

  function playBuf(b, gain = 1, when = 0) {
    if (!ac || muted) return null;
    const src = ac.createBufferSource();
    src.buffer = b;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(g).connect(master);
    src.start(ac.currentTime + when);
    return src;
  }

  const api = {
    init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ac.destination);
      // 空闲时把常用音效先合成好，避免第一次播放卡顿
      const warm = ['click', 'select', 'stamp_deny', 'stamp_approve', 'tray', 'tray_back', 'discrepancy', 'inspect_on',
        'inspect_off', 'thud', 'intercom', 'citation', 'detain', 'scuffle', 'day_hit', 'whoosh', 'sad', 'bell',
        'xray', 'gunshot', 'star', 'bad', 'coin', 'shop'];
      let i = 0;
      const step = () => { if (i < warm.length) { buffer(warm[i++]); setTimeout(step, 30); } };
      setTimeout(step, 50);
    },
    play(name, gain = 1, when = 0) {
      if (!ac) return null;
      return playBuf(buffer(name), gain, when);
    },
    bgmInfo() {
      if (!musSrc) return { dur: 0, loop: false };
      const d = musSrc.buffer.getChannelData(0);
      const q = Math.floor(d.length / 4);
      const rms = [];
      for (let k = 0; k < 4; k++) {
        let a = 0;
        const end = k === 3 ? d.length : (k + 1) * q;
        for (let i = k * q; i < end; i++) a += d[i] * d[i];
        rms.push(Math.sqrt(a / (end - k * q)));
      }
      return { dur: musSrc.buffer.duration, loop: musSrc.loop, rms };
    },
    paper(seed = 0) { if (ac) playBuf(buffer('paper' + (seed % 8), () => paper(seed % 8))); },
    step(seed = 0) { if (ac) playBuf(buffer('step' + (seed % 6), () => footstep(60 + (seed % 6)))); },
    key(seed = 0) { if (ac) playBuf(buffer('key' + (seed % 16), () => typekey(seed % 16)), 1.5); },
    mumble(text, pitch, seed) {
      if (!ac) return;
      const dv = Math.round(Math.min(1.3, 0.25 + 0.065 * [...text].length) * 100) / 100;
      const key = `mum${dv}|${pitch}|${seed % 12}`;
      playBuf(buffer(key, () => mumble(dv, pitch, seed % 12)));
    },
    printer(dur) { if (ac) playBuf(buffer('printer' + dur, () => printer(dur))); },
    ambient(on) {
      if (!ac) return;
      if (on && !ambSrc) {
        ambSrc = ac.createBufferSource();
        ambSrc.buffer = buffer('ambient', ambient);
        ambSrc.loop = true;
        ambGain = ac.createGain();
        ambGain.gain.value = muted ? 0 : 0.8;
        ambSrc.connect(ambGain).connect(master);
        ambSrc.start();
      } else if (!on && ambSrc) {
        ambSrc.stop();
        ambSrc = null;
      }
    },
    music(on) {
      if (!ac) return;
      if (on && !musSrc) {
        musSrc = ac.createBufferSource();
        musSrc.buffer = buffer('shop', MAKERS.shop);
        musSrc.loop = true;
        musGain = ac.createGain();
        musGain.gain.value = muted ? 0 : 0.45;
        musSrc.connect(musGain).connect(master);
        musSrc.start();
      } else if (!on && musSrc) {
        musSrc.stop();
        musSrc = null;
      }
    },
    stop(src) { try { if (src) src.stop(); } catch (e) { /* 已经停了 */ } },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      if (musGain) musGain.gain.value = muted ? 0 : 0.45;
      return muted;
    },
    get muted() { return muted; },
  };
  return api;
})();
