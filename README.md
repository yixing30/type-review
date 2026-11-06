# Type Review for Windows 🪟 (伴随式机械键盘打字音效客户端)

> 本项目基于李笑来老师开源的 **[xiaolai/type-review](https://github.com/xiaolai/type-review)** 与 **[xiaolai/type-review-app-macos](https://github.com/xiaolai/type-review-app-macos)** 深度定制开发，将其自适应打字练习体系与 macOS 版独特的“系统级伴随打字音效”完整移植到了 **Windows** 平台。

---

## 📌 制作来源与致敬 (Origin & Credits)

- **网页端核心打字引擎**：[xiaolai/type-review](https://github.com/xiaolai/type-review)（在线体验：[type.review](https://type.review)）
- **macOS 原生伴随音效客户端参考**：[xiaolai/type-review-app-macos](https://github.com/xiaolai/type-review-app-macos)
- **原作者**：李笑来（[@xiaolai](https://github.com/xiaolai)）
- **本项目仓库**：[yixing30/type-review](https://github.com/yixing30/type-review)

感谢笑来老师优秀的自适应打字算法设计与极简无遥测的隐私哲学！

---

## ✨ 与原版的核心不同之处 (What's New in Windows Port)

原版是一个纯 Web 前端应用（SolidJS + TypeScript + Vite），同时作者在 macOS 平台提供了专用的原生客户端外壳。为了让 **Windows 用户** 也能获得完全一致的无缝打字与声音体验，本项目针对 Windows 平台完成了以下深度改造与扩展功能：

### 1. 🪟 Windows 原生桌面端适配与交付
- **跨平台 Electron 架构**：原版 macOS 客户端依赖苹果专属的 Swift/Cocoa 框架，无法在 Windows 上运行；本项目基于现代 Electron 打造了完整的 Windows 桌面客户端，已解决本地资源协议隔离（`app://localhost` 安全沙箱）与 IndexedDB 数据持久化问题；
- **双模式分发打包**：支持一键构建 **绿色免安装单文件版（Portable .exe）** 与 **标准 Windows 安装向导包（Setup .exe）**。

### 2. 🔊 系统级全局按键音效（无处不在）
- **全系统伴随打字**：不同于常规仅在软件窗口内发声的打字工具，本项目移植了类似 macOS 版的全局事件监听。**无论主窗口是最小化还是完全关闭到后台，只要你在 Windows 的任何地方打字（微信聊天、QQ、浏览器、VS Code、Word 等），都会实时触发真实的按键敲击音效**；
- **左右手物理声像定位（Stereo Pan）**：根据 QWERTY / Colemak / Dvorak 物理键盘布局，左手击键声像偏左耳声道（-0.3），右手击键偏右耳声道（+0.3），在佩戴耳机时能感受到极为逼真的实体按键空间打击质感。

### 3. 🎹 7 款经典机械键盘与打字机音效随时可选
通过任务栏托盘菜单或软件设置界面，可实时自由切换：
1. **`Typewriter`（经典机械打字机）**：精选 1960 年代瑞士经典机械打字机（Hermes Precisa 305）高品质实录采样，长短击键与回车带金属机械感；
2. **`Mechvibe`（机械键盘原声）**：经典明亮机械轴体击打声；
3. **`Thock`（客制化麻将音）**：加厚消音棉厚重触底低音，声如麻将；
4. **`Clicky`（青轴段落音）**：清脆段落感与内部钢丝弹簧回响；
5. **`Soft`（轻柔静音轴）**：低音量、低通滤波的办公室静音体验；
6. **`Laptop`（笔记本剪刀脚）**：轻薄短行程铝合金面板回响；
7. **`Off`（彻底关闭）**：需要静音时直接选 `off` 即可从底层彻底切断音频节点，底层监听自动休眠，0 CPU 占用。

### 4. 🔄 软件设置与 Windows 系统托盘双向实时联动
- **双向无缝同步**：在打字软件内的【⚙️ 设置】（Settings）对话框或顶部音效选择器中切换音效或调整音量时，**后台全局音效和 Windows 托盘菜单勾选项会自动即时同步**；反之，在右下角托盘右键菜单中切换音效，软件界面的设置也会即时自动更新；
- **防双重发声机制**：在主窗口练习打字时由内置练习引擎发声，在其他软件窗口打字时由全局低延迟钩子发声，避免重叠造成杂音。

### 5. 🚀 开机自启动与系统托盘后台常驻
- **开机自启**：右键托盘图标勾选 **【🚀 开机自启动】**，电脑每次开机后自动静默进入托盘常驻，全程有敲击声，不需要手动打开打字练习窗口；
- **关闭即常驻**：点击右上角关闭按钮 `X` 自动隐藏到系统托盘，不中断音效。只有在托盘菜单明确点击“退出程序”时才会完全退出。

---

## 🛠️ Windows 本地开发与打包命令

```powershell
# 1. 安装项目依赖
pnpm install

# 2. 启动 Windows 桌面调试窗口
pnpm desktop:start

# 3. 编译前端并打包生成 Windows .exe 安装包与绿色版（输出至 release/ 目录）
pnpm desktop:build
```

---

*(以下为原项目官方英文文档 / The following is the original documentation from upstream)*

---

# TYPE · [type.review](https://type.review)

A typing-practice web app that **adapts to you** and **stays out of your way** — no account, no server, no telemetry.

> Adaptive letter-unlock + benchmark runs + bring-your-own text.

## What you get

- **Adaptive mode** — the app teaches you a small alphabet, then unlocks more letters as you get fast and accurate. Drilling weak keys without thinking about it.
- **Benchmark mode** — runs on real prose, ended by either word count or a timer (configurable).
- **Real text to type** — a curated library of public-domain quotes and short passages, your own `.txt` / `.md` uploads, or paste a one-off paragraph via the *custom text* affordance.
- **Per-key + per-finger stats** — a stats dashboard with per-source WPM trends, finger speed/error breakdown, daily-run streaks, and milestone tracking. Every run feeds the same model regardless of mode.
- **An on-screen keyboard** (optional) — colour-coded by your per-key mastery, with live press-state. Mac and Windows layouts. QWERTY, Colemak, Dvorak keymaps.
- **Mechanical-keyboard sounds** (optional) — synthesised mechvibe + soft packs, plus a real-sample typewriter pack. Synth packs generate on-device with Web Audio.
- **Sharable results** — `copy share link` on Results emits a `#/share/<payload>` URL; recipients see a read-only card of the run.
- **Long-form in-app reading** — the *Why typing matters* essay (and any future essays under `public/articles/<slug>/article.md`) renders as part of the app.
- **Four themes** — dark, light, sepia, high-contrast. sRGB fallbacks for pre-2023 browsers.
- **Your data, on your device** — IndexedDB, no account. One click exports a JSON backup; one click wipes it.

## Try it

[type.review](https://type.review) — it's a single page that loads, no sign-up, and starts working.

## Privacy

- No analytics, no telemetry, no cookies.
- No third-party fonts at runtime. The CSS hints at Geist + Geist Mono but the app ships zero font files — if the user agent doesn't already have them, the system-font fallback chain renders the page; no font request is ever made.
- Your typing history lives in your browser's IndexedDB. The app never sends it anywhere.
- If you upload your own text in the library, it stays in IndexedDB. It's never uploaded.

See the in-app `#/about` page for the full privacy summary.

## Keyboard shortcuts

- **Type** — just type. The app captures everything that's not a modifier.
- **Tab** — start with fresh text (new passage).
- **Enter** on the results screen — start the next run.
- **Esc** — never used by the app; reserved for your OS / browser.

For a deeper walkthrough of modes, settings, scoring, and the source picker, see [`#/guide`](https://type.review/#/guide) (or the catalog of everything at [`#/features`](https://type.review/#/features)).

## For contributors

Everything below is for people working on the app itself.

### Stack

SolidJS + TypeScript (strict) · Vite · Vitest + jsdom · Biome · pnpm.
The only runtime dep is `solid-js`.

### Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # full Vitest suite
pnpm test:coverage
pnpm typecheck
pnpm lint         # Biome
pnpm lint:fix
pnpm build        # tsc --noEmit && vite build → dist/
pnpm preview      # serve dist locally
```

### Architecture in one sentence

A pure TypeScript **engine** (typing loop, metrics, adaptive letter-unlock planner, corpus, session orchestrator) sits at the bottom; thin **io** adapters (DOM input bus, IndexedDB persistence, Web Audio sounds) sit in the middle; a **SolidJS UI** sits on top. The hot keystroke loop never flows through reactive state — keystrokes mutate a plain `Session` and the UI subscribes to RAF-batched snapshots.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for layer rules, the data flow, and the corpus seam.

### Deployment

[type.review](https://type.review) is served by **Cloudflare Pages**. To redeploy after a build:

```bash
pnpm build
pnpm dlx wrangler pages deploy dist --project-name=type-review --branch=main
```

(Auth via `CLOUDFLARE_EMAIL` + `CLOUDFLARE_API_KEY` env vars, or `CLOUDFLARE_API_TOKEN`.)

The repo ships header policies for Netlify / Cloudflare Pages / Vercel:

- **Content-Security-Policy**: `default-src 'none'` baseline, only same-origin scripts/styles, no inline anything, `frame-ancestors 'none'`
- **COOP/COEP**: `same-origin` + `require-corp` (enables full-resolution `performance.now()`)
- **Permissions-Policy**: deny camera / microphone / geolocation / payment / usb
- **X-Frame-Options**: `DENY` · **X-Content-Type-Options**: `nosniff` · **Referrer-Policy**: `no-referrer`

For Apache / Nginx / S3+CloudFront, translate the same policy to your host. Subresource Integrity is intentionally not configured — all assets are served same-origin.

### Identifiers used on the client

| Surface | Value | Notes |
|---|---|---|
| Package name | `type-review` | `package.json` |
| IndexedDB database | `type-review` (v2) | object stores: `profile`, `user-corpus` |
| localStorage keys | `type-review:theme`, `type-review:has-saved-profile`, `type-review:show-keyboard`, `type-review:keyboard-layout`, `type-review:sound-pack`, `type-review:sound-volume`, `type-review:corpus-channel` | preferences only — no PII |
| BroadcastChannel | `type-review` | cross-tab "another tab saved" notification |
| Console log prefix | `type-review: <stage> failed` | from `src/ui/log.ts` |

These are every string a user-agent sees from this app. None of them surface in the UI; the visible brand is **TYPE**.

### Contributing

This codebase optimises for **clarity over cleverness** and **fail-loud invariants**. Before opening a PR:

1. `pnpm typecheck && pnpm lint && pnpm test` — all must pass (CI enforces).
2. Don't destructure SolidJS `props` (breaks reactivity). Read via `props.x` inside JSX.
3. Don't mutate `session.profile` directly — route through `Session.updateSettings` (the only validated write path from UI to engine).
4. Layer purity is checked by `src/layer-purity.test.ts` — `engine` may not import `io` or `ui`; `io` may not import `ui`.

### License

[MIT](./LICENSE). Bundled corpus content (quotes + code snippets) is curated from public-domain sources plus short fair-use quotation snippets; each entry carries its own `license` field — see `LICENSE` and `src/io/corpus/data/`.
