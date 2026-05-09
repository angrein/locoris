import { isTauri } from "@tauri-apps/api/core";
import { BaseDirectory, exists, mkdir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";

import { DESKTOP_VAULT_BACKUP_DIRECTORY } from "./desktopRuntimeLayout";
import type { DesktopLocalVaultBackup } from "../types";

const DESKTOP_VAULT_BACKUP_SCHEMA_VERSION = 1;

function sanitizeVaultPathSegment(localVaultId: string) {
  return localVaultId.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "local-default";
}

function buildDesktopVaultBackupPath(localVaultId: string) {
  return `${DESKTOP_VAULT_BACKUP_DIRECTORY}/${sanitizeVaultPathSegment(localVaultId)}.json`;
}

function isDesktopBackupRecord(value: unknown): value is DesktopLocalVaultBackup {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.schemaVersion === DESKTOP_VAULT_BACKUP_SCHEMA_VERSION &&
    typeof record.localVaultId === "string" &&
    Array.isArray(record.projects) &&
    Array.isArray(record.folders) &&
    Array.isArray(record.tags) &&
    Array.isArray(record.notes) &&
    Array.isArray(record.assets) &&
    Array.isArray(record.syncDirtyEntries) &&
    Array.isArray(record.syncShadows) &&
    Array.isArray(record.syncTombstones)
  );
}

async function ensureDesktopVaultBackupDirectory() {
  await mkdir(DESKTOP_VAULT_BACKUP_DIRECTORY, {
    baseDir: BaseDirectory.AppData,
    recursive: true
  });
}

export function supportsDesktopVaultBackups() {
  return isTauri();
}

export async function hasDesktopVaultBackup(localVaultId: string) {
  if (!supportsDesktopVaultBackups()) {
    return false;
  }

  return exists(buildDesktopVaultBackupPath(localVaultId), {
    baseDir: BaseDirectory.AppData
  }).catch(() => false);
}

export async function readDesktopVaultBackup(localVaultId: string): Promise<DesktopLocalVaultBackup | null> {
  if (!supportsDesktopVaultBackups()) {
    return null;
  }

  const path = buildDesktopVaultBackupPath(localVaultId);
  const fileExists = await hasDesktopVaultBackup(localVaultId);

  if (!fileExists) {
    return null;
  }

  try {
    const raw = await readTextFile(path, {
      baseDir: BaseDirectory.AppData
    });
    const parsed = JSON.parse(raw);

    if (!isDesktopBackupRecord(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function writeDesktopVaultBackup(localVaultId: string, backup: DesktopLocalVaultBackup) {
  if (!supportsDesktopVaultBackups()) {
    return;
  }

  await ensureDesktopVaultBackupDirectory();
  await writeTextFile(buildDesktopVaultBackupPath(localVaultId), JSON.stringify(backup), {
    baseDir: BaseDirectory.AppData
  });
}

export async function deleteDesktopVaultBackup(localVaultId: string) {
  if (!supportsDesktopVaultBackups()) {
    return;
  }

  const path = buildDesktopVaultBackupPath(localVaultId);

  if (!(await hasDesktopVaultBackup(localVaultId))) {
    return;
  }

  await remove(path, {
    baseDir: BaseDirectory.AppData
  }).catch(() => undefined);
}
