# Locoris Backups And Export

Locoris has two backup/export goals:

- exact recovery of an active local vault;
- readable exit paths for users who want portable data.

## Exact Backup

The `.locorisbackup` format is the exact recovery format.

It can include:

- projects;
- folders;
- tags;
- notes;
- canvases;
- assets;
- planner data;
- local settings;
- sync metadata required for restoring the local vault state.

Restoring an exact backup can replace the active local vault after explicit confirmation.

## Readable ZIP

The readable ZIP export is for portability and inspection outside Locoris.

It can include:

- the vault hierarchy;
- Markdown notes;
- HTML notes;
- attachments;
- canvas JSON;
- canvas PNG previews when rendering is available;
- planner markdown files;
- bundled export fonts and font licenses when allowed.

Readable ZIP is not the full recovery format. It is the no-lock-in export path.

## Product Rule

Do not confuse exact recovery with readable export.

The UI and docs should state clearly:

- use `.locorisbackup` when you want full Locoris restore;
- use readable ZIP when you want human-readable files outside Locoris.

