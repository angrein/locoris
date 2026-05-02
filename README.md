# Locoris

Locoris is an offline-first knowledge workspace with an orbital map interface.

## Repositories

This repository is the public product surface:

- web client
- future native shell entrypoint
- personal self-hosted sync server
- shared sync core used by the public runtimes

The managed cloud runtime lives in a separate private repository.

## Workspace Layout

```text
apps/
  app/               # Locoris web app
  personal-server/   # free self-hosted server

packages/
  sync-core/         # shared sync protocol/runtime helpers

docs/
  architecture/
  design/
  setup/

infra/
  docker/
```

## Local Run

```bash
npm install
npm run dev
```

## Personal Sync Server

```bash
SYNC_TOKEN=local-dev-token npm run sync-server
```

By default the personal server stores runtime data in an OS-appropriate app data directory:

- macOS: `~/Library/Application Support/Locoris/Personal Server`
- Windows: `%LOCALAPPDATA%\\Locoris\\Personal Server`
- Linux: `$XDG_DATA_HOME/locoris/personal-server` or `~/.local/share/locoris/personal-server`

Override it with `SYNC_DATA_DIR=/absolute/path`.

## Google Drive Setup

Google Drive sync uses OAuth in the browser and stores remote vaults in the hidden `appDataFolder`.

1. Copy the env template:

```bash
cp apps/app/.env.example apps/app/.env
```

2. Set your Google OAuth web client id in `apps/app/.env`.

3. Start the app and connect Google Drive from `Settings → Synchronization → Add connection → Google Drive`.

Detailed guide:

- [docs/setup/google-drive.md](docs/setup/google-drive.md)
