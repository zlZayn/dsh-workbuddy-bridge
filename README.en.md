# DSH WorkBuddy Bridge

English | [中文](./README.md)

Brings every model in the WorkBuddy desktop app (GLM-5.3, GLM-5.2, DeepSeek-V4-Pro, DeepSeek-V4-Flash, Kimi-K3, MiniMax-M3, Hy3, and more) straight into [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — zero configuration in the DSH chat.

Both the CN **WorkBuddy** and the international **WorkBuddy AI** apps are supported (international support since **v0.5.0**): whichever one you have installed shows up as its own model group, and having both installed shows both, each with its own account and credit.

## Features

- **Works out of the box**: install and enable the plugin, then use it directly in DSH — no extra configuration.

![WorkBuddy models in the DSH model picker](assets/1.png)

- **CN and international side by side**: the CN app appears as the **WorkBuddy** group and the international one as **WorkBuddy AI**. Their models, accounts, and credit never mix. **Each group follows only its own app's sign-in**: install just the international app and only WorkBuddy AI appears; install both and both groups appear; sign out of one and that group goes away. Settings likewise shows **one card per version**, each with its own account and balance.

![WorkBuddy AI models in the DSH model picker](assets/5.png)

- **Image input**: most models accept images — paste or drop one straight into the conversation (GLM-5.3-Flash, GLM-5.2, the DeepSeek-V4 series, and more); the few text-only models (e.g. GLM-5.1) clearly say so.

- **Reasoning levels**: levels explicitly declared by WorkBuddy appear directly — for example, GLM-5.3 and GLM-5.3-Flash offer low / high / max. For some models that do not declare selectable levels, Web and Desktop provide a **Reasoning levels** control in the model picker for a manual check. It sends a few requests and may consume credit. Models without a check result or selectable levels continue to use WorkBuddy's default.

- **Status and detection**: main UI → Plugins → workbuddy-bridge → View shows the account, token validity, remaining credit, and model offers. It also lets you refresh the model list manually and shows whether the current list came from the upstream or from the built-in fallback, and provides manual reasoning-level detection for eligible models.

- **Model visibility**: both WorkBuddy and WorkBuddy AI cards (Context window tab) let you check which models appear in the model picker. Hidden lists are **saved per signed-in account**: switching accounts switches to that account's own list, switching back restores it; new accounts and newly added models are visible by default. Hiding only affects pickability — **existing chats using a hidden model keep working**.

On the plugin page, the plugin's **configuration form** (auth-file paths, detection consent, maximum context window) sits above the two cards:

![Model visibility in the context-window list (plugin configuration page)](assets/6.png)

- **Enterprise credit**: on the CN product, enterprise accounts (non-empty `enterpriseId`) read their cycle quota from the enterprise billing endpoint, and the card shows an "enterprise quota" row with the cycle reset time.

- **Rate**: every model name carries its credits multiplier (e.g. `GLM-5.2 · x0.79`, `Hy3 · x0.00`) in both the `/model` popup and the composer's model dropdown. The rate is display-only and never affects requests.

- **Promo badges**: promo badges (`限时免费`, `夜间折扣`) ride the model name itself (e.g. `Hy4 preview · x0.00 · 限时免费`), visible wherever you pick a model; the status card also collects currently-discounted models. Per the WorkBuddy service data, synced each time DSH starts. The international version's promotions come from the service's `modelPromotions` (which carry an effective window). Once a promotion lapses its badge is withdrawn; because the service writes the discounted value into the model's own rate field, the original price cannot be reconstructed, so that model then reports "price unavailable — refresh to update" rather than repeating the discounted rate or claiming the model is free.

![Settings card showing the plugin](assets/2.png)

The expanded card has three tabs: **Status** shows the account, token validity, total credit, catalog source, and reasoning-level detection; **Context** lists each model's context window (where the international version offers a larger declared window, whether to use it is decided by the switch in the **configuration form** — **on by default**, so DSH sizes context compression to the largest window the upstream declares; the card only reports the current state and carries no second switch); **Details** shows per-package credit and model offers. The CN and international versions each get their own card, showing their own account's information.

![Settings card showing account and remaining credit](assets/3.png)

## Why reasoning levels work this way

Information about WorkBuddy models' reasoning levels is currently split between upstream API responses and private UI logic in the client, while the model catalog changes quickly. If the plugin filled in one uniform set of levels for every model without an upstream declaration, it would need to keep chasing unpublished product logic with no stable contract.

![Reasoning-level detection in the composer](assets/4.png)

Testing also found that some models accept the `reasoning_effort` parameter while ignoring unknown values and falling back to their default behavior. A successful request alone therefore does not prove that a level is actually usable.

For models without declared levels, Web and Desktop instead use user-authorized, on-demand detection: it first confirms that the upstream validates the parameter, then checks which standard levels it accepts. The check sends a few requests and may consume credit. Its result means only that the upstream currently accepts that level; it does not promise a particular change in reasoning quality, speed, or credit use.

## Install

Prerequisite: the WorkBuddy desktop app is installed and signed in. The plugin reuses the app's sign-in state and follows account switches automatically; the same applies to the international WorkBuddy AI app, and the two do not affect each other.

**Match the plugin version to your DSH core** — a mismatched combination fails to start DSH:

| Plugin | Required DSH core | Desktop app |
|---|---|---|
| **0.7.0+ (official-UI refactor)** | `0.1.7-rc.2` and the `0.1.7` stable (newer prereleases such as `0.1.8-alpha.x` are NOT covered automatically) | desktop builds bundling `0.1.7+` |
| **0.6.x (dual-UI adaptive)** | `0.1.5-rc.1` – `0.1.7-alpha.1` (incl. the `0.1.6` stable) | `2.0.7`+ |
| **0.3.2 – 0.5.4** (international support since `0.5.0`) | the `0.1.5-rc.1` line only (no `0.1.6+`; see [#41](https://github.com/zlZayn/dsh-workbuddy-bridge/issues/41)) | `2.0.7`+ (bundled core `0.1.5-rc.1`) |
| **0.3.0 – 0.3.1** | `0.1.2-rc.1` | `2.0.5` |
| **0.2.6** | `0.1.1-rc.2` (older line) | `2.0.3` / `2.0.4` |

- **0.7.0 returns to single-generation support and targets `0.1.7`**: the UI is rebuilt on the official UI contracts (the plugin page's `plugins.bundle.config` entry, the official settings form stack, the official CSS Modules build chain), and the dual-generation compatibility layer 0.6.x carried is gone. Still on `0.1.5` / `0.1.6`? Use `0.6.1`, which keeps receiving security fixes.
- **One configuration entry on 0.1.7**, with configuration and live state kept apart:

  ```text
  DSH 0.1.7 + this plugin 0.7.0
  ├─ main UI → Plugins → workbuddy-bridge → View
  │   ├─ config form   ✅ authFile / authFileAI / detection consent / max context window
  │   ├─ WorkBuddy card      ✅ CN account, credit, catalog, visibility, detection
  │   └─ WorkBuddy AI card   ✅ international, same as above
  ├─ Settings → Built-in Plugins
  │   └─ workbuddy-bridge   ← read-only inventory (runtime status), no config entry
  └─ chat model picker
      └─ WorkBuddy / WorkBuddy AI groups ✅
  ```

- On DSH `0.1.7`, just install the latest: `dsh plugin --profile web add dsh-workbuddy-bridge`
- Still on DSH `0.1.5` / `0.1.6`? Stay on `0.6.1`.
- Still on DSH `0.1.2-rc.1`? Stay on `0.3.1`: `dsh plugin --profile web add dsh-workbuddy-bridge@0.3.1`
- Still on DSH `0.1.1-rc.2`? Stay on the older release: `dsh plugin --profile web add dsh-workbuddy-bridge@0.2.6`
- The desktop app has bundled `0.1.5-rc.1` since `2.0.7`; desktop builds bundling the `0.1.7` core can use the latest plugin directly.

The plugin runs under all three DSH interfaces: **Web**, **Desktop**, and **TUI**. Pick the install command that matches the profile you use.

```sh
# Web (recommended; ships prebuilt artifacts)
dsh plugin --profile web add dsh-workbuddy-bridge
dsh web

# or install the Web version from the GitHub source
dsh plugin --profile web add github:zlZayn/dsh-workbuddy-bridge
dsh web
```

```sh
# Desktop (the DSH Desktop app)
dsh plugin --profile desktop add dsh-workbuddy-bridge
dsh --profile desktop
```

```sh
# TUI (terminal UI)
dsh plugin --profile dsh-tui add dsh-workbuddy-bridge
dsh --profile dsh-tui
```

> **TUI users, check the version pairing**: the terminal UI package (`@deepseek-harness-tui/dsh-tui`) must be **`0.10.0-beta.5` or newer** — older versions fail at startup with `events is not iterable` when this plugin is installed. Update the shell first (via its built-in update command or a fresh install), then add this plugin; the newest release is a beta, and a stable one will work the same way.

> Manual reasoning-level detection is currently available only on Web and Desktop; TUI does not provide a detection action.

> Note: the `dsh-tui` profile requires pnpm 11 to install packages (a different pnpm on PATH fails with `ERR_PNPM_UNEXPECTED_STORE` — use `npx pnpm@11`).

After installing, switch to a WorkBuddy model in the model picker of the interface you chose. On Web and Desktop, the plugin page shows the account, token validity, and remaining credit, can refresh the model list manually, and can check eligible models for reasoning levels; the CN and international versions each have their own card. On TUI, configure `authFile` in `/settings` (or `authFileAI` for the international version).

## CLI

`dsh plugin --profile <web|desktop|dsh-tui> exec dsh-workbuddy-bridge status`: sign-in state and remaining credit (`--json` for machine-readable output; `doctor` for diagnostics and `logout` for credential cleanup are also available).

Both commands target the CN version by default; add `--provider workbuddy-ai` for the international one:

```sh
dsh plugin --profile web exec dsh-workbuddy-bridge status --provider workbuddy-ai
dsh plugin --profile web exec dsh-workbuddy-bridge doctor --provider workbuddy-ai
```

`logout` removes only that version's plugin-owned credential copy. It leaves the desktop app's own sign-in alone and does not promise the model group will disappear (the app's credential file still supplies one).

## Known limitations

- Verified on macOS with the DSH Web / Desktop / TUI profiles (as of 0.7.0 this requires `0.1.7-rc.2`+ and Node 22+; TUI requires the terminal UI package `0.10.0-beta.5` or newer — see the Install section). Windows probes Local and Roaming AppData in order; WSL first reads credentials from the mounted Windows user profile. If the Windows and Linux user names differ and Windows environment variables are not forwarded into WSL, point `WORKBUDDY_AUTH_FILE` (or `WORKBUDDY_AI_AUTH_FILE` for the international version) at the actual file.
- **The international version's model catalog comes from the app's own interface**: the service splits it by User-Agent, which is a private implementation detail that a server-side change can break. When that happens the plugin degrades to this account's last successful catalog and then to its built-in roster, showing the source (live / saved / built-in), the fetch time, and the failure reason on the card — but long-term compatibility is not guaranteed. The CN version's catalog uses the same interface as the official CLI and is unaffected.
- **International-version environments not yet covered**: on Windows / WSL / Linux no reliable source for the international app's version has been located yet, so the saved value or the built-in default is used. On macOS, real-shim checks covered complete GPT-family replies, tool calls, and continued turns.
- **Behaviour change with no credentials**: a version whose app was never signed in — and that left no plugin-owned copy — no longer shows a model group. The CN version used to display a built-in fallback list, but every model on it failed when selected.
- **The enterprise credit path currently covers the CN product only**: the international enterprise billing interface is unverified, so those accounts still read through the personal endpoint pending measurement. The enterprise branch could not be tested locally (the development machine holds a personal account); it was implemented from the official app's interface contract, and reports from enterprise users are welcome.
- Relies on WorkBuddy client interfaces (not a public API); the plugin may need updates as WorkBuddy changes.

## Disclaimer

- This project is for **personal learning and research only**, driving your own WorkBuddy account on your own machine. Do not use it commercially or beyond reasonable personal use.
- Users must comply with the WorkBuddy terms of service. Any consequence of using this project (including but not limited to account restrictions, depleted credit, or service interruption) is borne by the user.
- The author is not liable for any direct or indirect loss arising from the use or misuse of this project.
- This project is not affiliated with, endorsed by, or sponsored by Tencent, WorkBuddy, or DeepSeek. Product names are used for compatibility description only; trademarks belong to their respective owners.

## Acknowledgements

- [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api) (MIT) — reference implementation of the WorkBuddy upstream protocol.
- [franksong2702/dsh-codex-connect](https://github.com/franksong2702/dsh-codex-connect) (Apache-2.0) — reference for the DSH plugin structure and provider registration.

## License

[MIT](./LICENSE)
