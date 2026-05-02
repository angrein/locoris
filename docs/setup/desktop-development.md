# Desktop Development

`Locoris` uses a shared React/Vite app with a `Tauri 2` desktop shell.

## Scope

- Web app source: `apps/app/src`
- Desktop shell: `apps/app/src-tauri`
- Shared repo: `locoris`

## Current target platforms

- macOS
- Windows

Android stays in the same codebase path later, but is not part of the first desktop phase.

## Prerequisites

### Common

- Node.js
- npm
- Rust toolchain

### macOS

- Xcode Command Line Tools

### Windows

- Visual Studio Build Tools or full Visual Studio with the C++ desktop workload
- WebView2 runtime

## Commands

From repo root:

```bash
cd /Users/dzen/bots/locoris
npm run desktop:info
npm run desktop:dev
npm run desktop:build:debug
```

Or directly from app workspace:

```bash
cd /Users/dzen/bots/locoris/apps/app
npm run desktop:info
npm run desktop:dev
npm run desktop:build:debug
```

## Notes

- `desktop:dev` starts the Vite dev server automatically through Tauri.
- `desktop:build` runs the web build first and then bundles the desktop app.
- Tauri config lives in `apps/app/src-tauri/tauri.conf.json`.
- The bundle identifier is `com.locoris.app`.

## Next integration steps

1. Replace browser-only storage for vault/sync registries with a native desktop-backed store.
2. Add deep-link handling for Google OAuth callback flows.
3. Move sensitive secrets to a native secure storage strategy.
4. Add updater, signing and notarization for release builds.
