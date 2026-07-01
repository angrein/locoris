# Storage Compatibility Notes

Locoris contains some legacy internal identifiers that still use older names.

These identifiers are not product branding and should not appear in new user-facing UI. They are kept to preserve existing user data and sync compatibility.

## Known Legacy Keys

Examples:

- `zen-notes.local-vaults`;
- `zen-notes.sync-registry`;
- `zen-notes.appAccentThemeId`;
- `zen-notes.orbitalAnimationMode`;
- `zen-notes.vault-passphrase:`;
- `zen-sync-key-check:v1`;
- `zen-sync-manifest.json`.

## Why They Stay For Now

Renaming these keys without a migration can break:

- local vault discovery;
- existing IndexedDB database names;
- sync registry state;
- private vault passphrase verification;
- Google Drive remote manifest discovery;
- secure-secret fallback storage.

## Migration Rule

Only replace a legacy key when the implementation:

1. reads both old and new keys;
2. writes the new key after successful read;
3. preserves the old key until compatibility is proven;
4. includes rollback-safe behavior;
5. is tested against existing local vaults, private vaults, Google Drive sync, hosted sync, and self-hosted sync.

Display labels and public docs must use Locoris naming even while legacy internal keys remain.

