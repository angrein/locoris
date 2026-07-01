# Desktop Development

`Locoris` uses a shared React/Vite app with a `Tauri 2` desktop shell.

## Scope

- Web app source: `apps/app/src`
- Desktop shell: `apps/app/src-tauri`
- Shared repo: `locoris`

## Current target platforms

- macOS
- Windows
- Android through the Tauri Android target

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
npm run desktop:info
npm run desktop:dev
npm run desktop:build:debug
```

Or directly from app workspace:

```bash
cd apps/app
npm run desktop:info
npm run desktop:dev
npm run desktop:build:debug
```

## Notes

- `desktop:dev` starts the Vite dev server automatically through Tauri.
- `desktop:build` runs the web build first and then bundles the desktop app.
- Tauri config lives in `apps/app/src-tauri/tauri.conf.json`.
- The bundle identifier is `com.locoris.app`.
- Desktop and Android share the same React application surface.
- Desktop runtime state is separated from the bundled app and documented in [desktop-data-lifecycle.md](desktop-data-lifecycle.md).
- Google Drive desktop OAuth uses a native flow through the system browser and local loopback callback.
- Sensitive sync secrets should use native secure storage when available and a compatibility fallback only when necessary.
- Release signing/notarization is separate from Tauri updater signing.
