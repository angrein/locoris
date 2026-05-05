# Locoris Desktop Release

This document describes the desktop release pipeline for `Locoris App 1.x+`.

## Workflows

- Windows manual bundle build:
  - [`.github/workflows/tauri-desktop-windows.yml`](/Users/dzen/bots/locoris/.github/workflows/tauri-desktop-windows.yml)
- macOS manual bundle build:
  - [`.github/workflows/tauri-desktop-macos.yml`](/Users/dzen/bots/locoris/.github/workflows/tauri-desktop-macos.yml)
- Tagged desktop release for GitHub Releases:
  - [`.github/workflows/tauri-desktop-release.yml`](/Users/dzen/bots/locoris/.github/workflows/tauri-desktop-release.yml)

## Release trigger

Desktop releases are built from tags in this format:

- `app-v1.0.0`
- `app-v1.0.1`
- `app-v1.1.0`

The release workflow also supports `workflow_dispatch`, but the canonical product flow is tag-based.

## Updater

`Locoris` is configured to generate updater artifacts and query the latest GitHub release metadata from:

- `https://github.com/angrein/locoris/releases/latest/download/latest.json`

Updater artifacts require the Tauri updater signing key.

### Required GitHub secret

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The public updater key is committed in the Tauri config and is safe to ship.

## Unsigned desktop distribution

`Locoris` is intentionally prepared for unsigned desktop distribution today:

- macOS builds are bundled without Apple signing and notarization
- Windows builds are bundled without Authenticode signing

This keeps the release pipeline simple while no Apple Developer account or Windows signing certificate is available.

### Expected platform behavior

- macOS users should expect Gatekeeper warnings for unsigned apps
- Windows users should expect SmartScreen warnings for unsigned installers

These warnings are normal for the current distribution strategy.

### Important distinction

Tauri updater signing is still enabled.

This is **not** Apple or Windows app signing. It is only used so the app can verify that update manifests and update artifacts were produced by the Locoris release pipeline.

## Manual local commands

From the public repo root:

```bash
cd /Users/dzen/bots/locoris
npm install
npm run desktop:info
npm run desktop:dev
npm run desktop:build
```

## Notes

- Tauri app version should match the release tag version.
- The updater private key must never be committed to this repository.
- Desktop runtime settings now prefer the Tauri-backed store and fall back to browser storage on web.
