'use strict';
// 缺字门禁：遍历全部源码字符，比对 assets.js 字形图集码位，缺字报错阻断部署。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets.js'), 'utf8'), sandbox);
const FM = sandbox.window.ASSETS.font;

const files = fs.readdirSync(root).filter((f) => f.endsWith('.js') && f !== 'assets.js').map((f) => path.join(root, f))
  .concat(fs.readdirSync(path.join(root, 'content')).map((f) => path.join(root, 'content', f)))
  .concat([path.join(root, 'index.html')]);

const chars = new Set();
for (const f of files) {
  for (const ch of fs.readFileSync(f, 'utf8')) {
    if (ch.codePointAt(0) >= 32 && !'\t\r\n'.includes(ch)) chars.add(ch);
  }
}
const missing = [...chars].filter((ch) => !FM['12'][ch] && !FM['10'][ch] && !FM['8'][ch]);
if (missing.length) {
  console.error('缺字（' + missing.length + '）：', missing.join(''));
  process.exit(1);
}
console.log('字符校验通过：', chars.size, '个字符全部有字形');