# Locoris Personal Server

Free self-hosted sync runtime for one owner with many remote vaults.

## Run

```bash
SYNC_TOKEN=local-dev-token npm run sync-server
```

or directly inside this workspace package:

```bash
npm run start --workspace @locoris/personal-server
```

## Data Directory

Default runtime data location:

- macOS: `~/Library/Application Support/Locoris/Personal Server`
- Windows: `%LOCALAPPDATA%\\Locoris\\Personal Server`
- Linux: `$XDG_DATA_HOME/locoris/personal-server` or `~/.local/share/locoris/personal-server`

Override it with:

```bash
SYNC_DATA_DIR=/absolute/path
```
