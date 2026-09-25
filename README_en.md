<p align="center">
  <h1 align="center">dsh-workbuddy-bridge</h1>
</p>

<div align="center">
  <p><strong>WorkBuddy desktop models in DeepSeek Harness</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/dsh-workbuddy-bridge"><img src="https://img.shields.io/npm/v/dsh-workbuddy-bridge?style=flat" alt="npm"></a>
    <a href="https://github.com/zlZayn/dsh-workbuddy-bridge/actions/workflows/ci.yml"><img src="https://github.com/zlZayn/dsh-workbuddy-bridge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4176E6?style=flat" alt="DeepSeek Harness Plugin"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  </p>

  <p>
    <strong><a href="README.md">简体中文</a></strong> · <a href="README_en.md">English</a>
  </p>
</div>

---

> [!NOTE]
> **Credentials never leave this machine**: sign-in state is read from the WorkBuddy desktop app's own
> credential file and kept as one encrypted local copy; the browser half never sees a token, and none
> ever appears in the UI.

The CN **WorkBuddy** and the international **WorkBuddy AI** coexist: install one app and its model group
appears; install both and the two groups sit side by side, each with its own account and credit. The
models appear directly in the DSH model picker — no separate provider to configure.

<p align="center">
  <img src="assets/1.png" alt="WorkBuddy models in the DSH model picker" width="300">
  <br>
  <em>The CN version forms its own group in the model picker, each model carrying its credit rate and promo
  badge; installing the international version adds a "WorkBuddy AI" group the same way.</em>
</p>

## What it does

- **Zero configuration** — install, enable, and the model group appears by itself.
- **The two versions never cross** — "WorkBuddy" for the CN app, "WorkBuddy AI" for the international one;
  models, accounts and credit stay separate, and each group follows its own app's sign-in. Sign out of one
  and its group disappears while the other is unaffected.
- **Reasoning levels** — models that declare levels expose them directly; the rest can be **checked manually**
  on the plugin page (see [Why detection is manual](#why-detection-is-manual)). Unchecked models keep
  WorkBuddy's default level.
- **Model visibility** — tick which models appear in the picker on the card's "Models" tab; saved per
  signed-in account. Hiding only affects pickability — chats already using a hidden model keep working.
- **Credit and account** — the plugin page shows the signed-in account, remaining credit and per-package
  allowances, with a manual model-list refresh.
- **Image input** — most models accept pasted or dropped images; the few text-only models say so explicitly.
- **Three surfaces** — Web, Desktop and TUI all work; only the TUI lacks manual detection.

<p align="center">
  <img src="assets/2.png" alt="Plugin detail page: the configuration form and the two status cards" width="560">
  <br>
  <em>The plugin page: the configuration form on top, two cards below, each following its own app's sign-in.</em>
</p>

## Install

One prerequisite: the **WorkBuddy desktop app** is installed and signed in (WorkBuddy AI for the
international version) — the plugin reuses the app's sign-in state and follows account switches.

```sh
dsh plugin --profile web add dsh-workbuddy-bridge
dsh web
```

For Desktop and TUI swap `--profile web` for `desktop` / `dsh-tui` (the TUI needs the terminal plugin
`@deepseek-harness-tui/dsh-tui` ≥ `0.10.0-beta.5`, installed with pnpm 11 — see its docs).

Or from source:

```sh
git clone https://github.com/zlZayn/dsh-workbuddy-bridge.git
cd dsh-workbuddy-bridge
pnpm install && pnpm build
dsh plugin --profile web add "$PWD"
```

## The plugin page

Sidebar **Plugins** → installed → click **DSH WorkBuddy Bridge**. The configuration area sits right under the
description, editable in place, saved immediately:

- **Sign-in file paths** (CN / international) — leave blank to use the app's own location; usually unnecessary.
- **Allow reasoning-level detection** and **use the largest declared context window** — two switches, defaults are fine.

Configuration takes effect immediately — no restart needed. The live state on the cards (account, credit,
model list) comes from the two cards below.

<p align="center">
  <img src="assets/6.png" alt="Models tab: visibility, windows, rates" width="300">
  <img src="assets/7.png" alt="Detection tab: reasoning-level detection" width="300">
  <br>
  <em>Expanding the "WorkBuddy (CN)" card: the Models tab (left) manages visibility and shows windows and
  rates; the Detection tab (right) is one row per model — press Detect to confirm which reasoning levels
  it accepts, and the results also land in the model picker.</em>
</p>

<p align="center">
  <img src="assets/3.png" alt="Credits tab: total and per-package allowances" width="640">
  <br>
  <em>The Credits tab: the total on one line, each package's allowance as a bar below.</em>
</p>

## Why detection is manual

WorkBuddy's reasoning-level information is scattered across upstream endpoints and private client UI logic,
and the model catalog changes fast. Worse, testing showed some models **accept** `reasoning_effort` but
silently ignore unknown values — one successful request does not prove a level actually works. So the plugin
does not guess: you authorize detection in the configuration first, then each model is confirmed with a few
real requests on demand. Detection may consume a small amount of credit; a result only means **the upstream
currently accepts that level** — it does not promise any change in quality, speed, or cost.

## Command line

Check status without the UI:

```sh
dsh plugin --profile web exec dsh-workbuddy-bridge status          # sign-in state and credit
dsh plugin --profile web exec dsh-workbuddy-bridge status --json   # machine-readable
dsh plugin --profile web exec dsh-workbuddy-bridge doctor          # diagnose app discovery and credentials
dsh plugin --profile web exec dsh-workbuddy-bridge logout          # remove the plugin's local credential copy
```

Targets the CN version by default; add `--provider workbuddy-ai` for the international one. `logout` does not
touch the desktop app's own sign-in.

## Compatibility and known limits

- Supports the **DSH `0.1.7` line** only; the floor lives in [package.json](package.json) `engines.dsh` — no
  cross-generation compatibility.
- **Credential discovery is per platform**: macOS supported directly; Windows probes Local then Roaming
  AppData (tested working); WSL reads the mounted Windows user profile first. When nothing is found, point
  `WORKBUDDY_AUTH_FILE` (international: `WORKBUDDY_AI_AUTH_FILE`) at the actual file.
- **The international catalog comes from the app's UI endpoint** (private, may break upstream); the CN version
  uses the same official CLI endpoint.
- With no credentials the group does not appear — the plugin never shows a fallback list that would only error.
- Enterprise credit covers the CN version only.

Design notes → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); release process → [docs/PUBLISHING.md](docs/PUBLISHING.md);
maintainer map → [AGENTS.md](AGENTS.md).

## Disclaimer

- This project is **for personal study and research only**; it drives your own WorkBuddy account on your own
  machine. Do not use it commercially or beyond reasonable personal use.
- You must comply with WorkBuddy's terms of service; any consequences (account restriction, credit forfeiture,
  service interruption) are your own responsibility.
- The authors accept no liability for direct or indirect loss caused by use or misuse of this project.
- Not affiliated with, nor endorsed by, Tencent, WorkBuddy, or DeepSeek; names appear only to describe
  compatibility, and trademarks belong to their owners.

## Acknowledgements

- [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api) (MIT) — reference for the WorkBuddy upstream protocol.
- [franksong2702/dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect) (Apache-2.0) — reference for DSH plugin structure and provider registration.

## License

[MIT](LICENSE).