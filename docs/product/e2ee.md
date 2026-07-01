# Locoris Client-side Encryption

Locoris has client-side encrypted sync for private/encrypted vault flows.

## Current Model

Encryption is vault-scoped and passphrase-based.

Implementation properties:

- KDF: PBKDF2-SHA-256;
- iterations: 310,000;
- cipher: AES-GCM-256;
- IV length: 12 bytes;
- encrypted sync payloads contain encrypted snapshots or encrypted changes;
- passphrase validation is deterministic without storing the passphrase itself.

## What The Server Can Store

For encrypted sync, remote providers can store:

- encrypted snapshot payloads;
- encrypted change payloads;
- vault metadata required for sync;
- encryption descriptor metadata such as KDF/cipher parameters and salt;
- account/session/token metadata for hosted cloud.

The hosted server should not receive the user's private vault passphrase.

## Passphrase Responsibility

Private vault passphrases are not recoverable by Locoris Cloud.

If the user loses a private vault passphrase, the encrypted remote content cannot be decrypted by the server. Recovery must rely on another unlocked device, a local vault copy, or a backup.

## Marketing Language

It is accurate to say "client-side encrypted sync" when describing the implemented encrypted payload flow.

Use "zero-knowledge" only when the public security page explains:

- what metadata the server can see;
- what payload content the server cannot read;
- passphrase loss consequences;
- account data versus vault content;
- backup/export behavior;
- current threat model limits.

## Compatibility Note

Some internal key-check prefixes and storage keys still contain legacy names. They are kept for compatibility with existing encrypted vaults and local data. Do not rename them without a migration that preserves passphrase validation and existing sync state.

