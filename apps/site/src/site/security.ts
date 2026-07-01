export const securityPrinciples = [
  {
    title: "Local-first by default",
    copy: "Locoris can be used without an account. Vault data starts on the user's device, and sync is an explicit choice."
  },
  {
    title: "Client-side encrypted sync",
    copy: "Private or encrypted sync payloads are encrypted before upload. The hosted service should not receive the private vault passphrase."
  },
  {
    title: "Metadata is still real",
    copy: "Hosted infrastructure may see account, timestamps, payload sizes, vault identifiers, and operational logs needed to run the service."
  },
  {
    title: "Passphrase loss matters",
    copy: "Locoris Cloud cannot recover a private vault passphrase. Recovery depends on another unlocked device, a local copy, or a backup."
  },
  {
    title: "No lock-in exit paths",
    copy: "Exact backups restore Locoris vaults. Readable ZIP exports provide HTML/Markdown notes, attachments, and canvas data for portability."
  },
  {
    title: "Sync choice remains visible",
    copy: "Locoris Cloud, self-hosted sync, and Google Drive sync should stay clearly distinct so users know who operates their remote storage."
  }
];

export const trustMatrix = [
  {
    subject: "Local-only vault",
    visibleToLocoris: "No account or hosted payload required",
    userResponsibility: "Device security, local backups, and OS account protection"
  },
  {
    subject: "Locoris Cloud account",
    visibleToLocoris: "Account, subscription, sessions, sync metadata, support and operational logs",
    userResponsibility: "Account security and choosing what vaults to sync"
  },
  {
    subject: "Private encrypted payload",
    visibleToLocoris: "Encrypted payloads plus metadata needed to sync and store them",
    userResponsibility: "Private vault passphrase and recovery backups"
  },
  {
    subject: "Google Drive sync",
    visibleToLocoris: "No hosted Locoris account required for the remote storage path",
    userResponsibility: "Google account security and Drive access state"
  },
  {
    subject: "Self-hosted sync",
    visibleToLocoris: "No hosted Locoris infrastructure required",
    userResponsibility: "Server URL, token, uptime, backups, and server security"
  }
];
