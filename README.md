# AI, PLEASE · 请调好你的模型

> A MODEL DRESS-UP THRILLER —— 像素风「搭配AI」换装调参小游戏。
> 2026 Qoder 高校创造力大赛 · LifeHack 赛道参赛作品。全程序生成画面与音效，零构建、零外链、零真实 AI。

给 AI 娃娃穿外套、调温度、塞上下文、选人设、拉对齐……同一道互联网热梗问题，
不同参数搭配查表产出完全不同的预设答案；答完交给像素应用商店，
由预设「用户」打上 1–5 星并留下梗评论。五天二十五单，商店均分跌破 2.0 星就地「下架」。

## 怎么玩（5 步）

1. 打开链接，点「开始营业」，跳过或看完开场白。
2. 在工作台用 8 个控件给 AI 换装：底座 / 人设外套 / 温度 / 上下文 / 成本 / 安全对齐 / 联网 / 话痨度，娃娃即时变装变表情；底部「顾客喜好纸条」揭示六维偏好中的五维，被掩的一维写明「温度随缘 / 安全随缘」等，留给你实验。
3. 用 ◀▶ 挑一张热梗工单（city不city / 那咋了 / v我50 / 哈基米 / 班味 / 红温……），点「提问」看打字机答案演出。
4. 把答案交给顾客，看应用商店星级与梗评论；攒对齐币解锁隐藏外套与隐藏工单。
5. 每天 5 单后读《对齐真理报》结算；五天后迎接结局——或者中途均分跌破 2.0 星被下架。

随手可用的按钮：随机 / 重置 / 导出搭配卡（PNG 下载）；右上角声音开关与全屏；进度自动存档，标题页可续玩。

## 运行

- 直接双击 `index.html`，或 `python -m http.server 8123` 后访问 `http://127.0.0.1:8123/`。
- 纯静态多 script 零构建；画面为 640×360 离屏整帧放大（pixelated），音效由 `sfx.js` 离线合成，中文像素字为内嵌字形图集。
- 缺字门禁：`node tools/check_chars.js`（遍历全部源码与文案字符串比对图集码位）。
- 自动化回归：`ego-browser nodejs < tools/playtest.js`（需先起本地服务；覆盖 729,000 组参数遍历、全流程、跨天题目不重复断言、失败路径、存档续玩、导出下载、三档 resize、50 连点压测、声音/全屏同步）。
- 改文案后重跑字形管线：`python tools/build_assets.py`，再跑缺字门禁。

## 目录

| 路径 | 职责 |
|---|---|
| `index.html` | 缩放壳 / 横屏提示 / 声音与全屏按钮 |
| `gfx.js` `engine.js` `main.js` | 调色板与绘制原语 / 场景机与定时器与粒子 / rAF 与指针壳 |
| `sfx.js` | 离线合成音效 + 音高数组驱动 BGM |
| `doll.js` `workbench.js` | 娃娃分层换装绘制 / 8 控件工作台与排队街景 |
| `scenes.js` | 标题 / 开场 / 日卡 / 答案 / 商店 / 报纸 / 结局 / 下架 |
| `game.js` `rules.js` | 进度存档解锁推进 / 评分变体修饰星级评论判定 |
| `content/*.js` | 25 工单 ×4 变体、6 底座、10 人设、修饰库、评论池、解锁与结局文案 |
| `assets.js` | 字形图集 + 精灵 + 街景背景（base64 内嵌） |
| `tools/` | 字形管线、缺字门禁、ego-browser 回归脚本 |

## 复用与致谢（License）

- **引擎搬运**：[ip-please/ip-please.github.io](https://github.com/ip-please/ip-please.github.io)（MIT，作者 ctnyanya）。
  `gfx.js` / `engine.js` / `main.js` / `sfx.js` / 缩放壳与字形管线思路源自该项目，游戏层全部新写。
  原 MIT 版权行保留于 `LICENSE`。
- **中文像素字体**：[TakWolf/fusion-pixel-font](https://github.com/TakWolf/fusion-pixel-font)（OFL-1.1），
  许可证见 `OFL-fusion-pixel.txt`；字形经 `tools/build_assets.py` 子集化为图集。
- **热梗语料参考**：[yuboxie/chime](https://github.com/yuboxie/chime)（MIT），
  部分梗条目释义参考其 JSON；入库文案为本项目重写与自补。
- **致敬**：Lucas Pope《Papers, Please》的审查台演出语法，与《IP, PLEASE》的像素戏仿精神。
- **音乐风格**：学习 Laura Shigihara 为《植物大战僵尸》所作电子配乐的语汇（弹跳贝斯、八分琶音、铃铛点缀、轻鼓组），旋律与合成全部原创，未引用任何原曲音符。
- 世界观全虚构：对齐部 / 模型裁缝铺 / 《对齐真理报》 / 羊驼-7B / 探渊-Pro / 千答-开源 / 双子星-Q / 武心两言-Legacy / 开物-ABC；
  底座名影射中外 AI 大厂但绝不使用原名，不指涉任何真实公司、产品或人物。

本项目整体沿用 MIT（见 `LICENSE`），字体部分遵循 OFL-1.1。