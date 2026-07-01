# Locoris Personal Sync

Free self-hosted sync runtime for one owner with many remote vaults.

This is the advanced/control path for users who do not want to use Locoris Cloud.

The personal server can store plain or encrypted sync payloads depending on the vault and client configuration. Private vault passphrases stay on the client.

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

## Capabilities

- list remote vaults;
- create remote vaults;
- issue per-vault sync tokens;
- keep remote vault snapshots isolated;
- serve encrypted payloads without receiving the user's private vault passphrase.
