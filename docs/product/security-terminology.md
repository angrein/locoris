# Security Terminology Policy

This document defines how Locoris should describe privacy and encryption in product copy, docs, and UI.

## Allowed Now

Use these terms when they match the implementation:

- local-first;
- client-side encrypted sync;
- private vault;
- passphrase-protected private vault;
- readable export;
- no account required for local use;
- self-hosted sync;
- Google Drive sync through hidden app data storage.

## Use With Explanation

### End-to-end encryption

Use when describing encrypted sync between Locoris clients through a remote provider, but explain passphrase responsibility and metadata limits.

### Zero-knowledge

Do not use aggressively until the public security page and threat model are complete.

Before using "zero-knowledge", the docs must explain:

- what account metadata Locoris Cloud sees;
- what vault metadata may be visible;
- what content payloads are encrypted;
- what happens when a passphrase is lost;
- how backups and exports behave;
- what is outside the threat model.

## Avoid

Avoid vague claims such as:

- "military-grade encryption";
- "impossible to hack";
- "anonymous by default";
- "the server sees nothing" without metadata qualification.

## Required User-facing Warnings

Private vault flows must clearly state:

- Locoris Cloud cannot recover the private vault passphrase;
- another unlocked device or a backup may be needed for recovery;
- changing the passphrase re-encrypts remote encrypted sync state;
- disabling encryption should require explicit confirmation.

