# Locoris Desktop Data Lifecycle

## Runtime layout

Locoris now separates desktop runtime state into explicit buckets:

- `Data`
  - local vault SQLite snapshots
  - desktop JSON safety backups
- `Settings`
  - desktop store (`settings/locoris-client.store.json`)
- `WebView`
  - versioned browser/runtime profile
- `Cache`
  - disposable desktop cache artifacts
- `Logs`
  - native desktop logs (`appLogDir`)

## Platform behavior

### Windows

- user content is stored outside the bundled app
- the webview profile is versioned, so UI/runtime changes always land after an upgrade
- uninstall always removes disposable `webview`, `cache`, and `logs` runtime state through [`installer-hooks.nsh`](../../apps/app/src-tauri/windows/installer-hooks.nsh)
- NSIS uninstall keeps app data by default
- the built-in `Remove application data` checkbox wipes user data too

### macOS

- user content is stored outside `Locoris.app`
- the webview data store is versioned per app release
- uninstalling `Locoris.app` preserves user data by default
- use [`scripts/macos/uninstall-locoris.sh`](../../scripts/macos/uninstall-locoris.sh) with `--wipe-data` for a full wipe
- shortcut scripts:
  - `npm run desktop:uninstall:macos`
  - `npm run desktop:uninstall:macos:wipe`

## Manual QA flow

Run this flow before a desktop release:

1. Install current release build.
2. Create local notes/canvases and restart the app.
3. Upgrade to the next build without deleting app data.
4. Verify that:
   - the updated UI is present
   - local projects/notes/canvases are still present
   - sync settings are still present
5. On Windows, uninstall without the `Remove application data` checkbox and reinstall.
6. Verify that local content still loads.
7. On Windows, uninstall with the `Remove application data` checkbox and reinstall.
8. Verify that the app starts from a clean state.
9. On macOS, run `scripts/macos/uninstall-locoris.sh /Applications/Locoris.app --wipe-data`.
10. Reinstall and verify that the app starts from a clean state.
