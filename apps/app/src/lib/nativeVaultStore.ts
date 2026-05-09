import { invoke, isTauri } from "@tauri-apps/api/core";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";

import { buildNativeVaultDatabaseRelativePath } from "./desktopRuntimeLayout";
import type { DesktopLocalVaultBackup } from "../types";

function buildSnapshotPayload(snapshot: DesktopLocalVaultBackup) {
  return JSON.stringify(snapshot);
}

function parseSnapshotPayload(payload: string | null): DesktopLocalVaultBackup | null {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as DesktopLocalVaultBackup;
  } catch {
    return null;
  }
}

export function supportsNativeVaultStore() {
  return isTauri();
}

export async function hasNativeVaultSnapshot(localVaultId: string) {
  if (!supportsNativeVaultStore()) {
    return false;
  }

  return exists(buildNativeVaultDatabaseRelativePath(localVaultId), {
    baseDir: BaseDirectory.AppData
  }).catch(() => false);
}

export async function readNativeVaultSnapshot(localVaultId: string): Promise<DesktopLocalVaultBackup | null> {
  if (!supportsNativeVaultStore()) {
    return null;
  }

  const payload = await invoke<string | null>("native_vault_store_read", {
    localVaultId
  }).catch(() => null);

  return parseSnapshotPayload(payload);
}

export async function writeNativeVaultSnapshot(localVaultId: string, snapshot: DesktopLocalVaultBackup) {
  if (!supportsNativeVaultStore()) {
    return;
  }

  await invoke("native_vault_store_write", {
    localVaultId,
    snapshotJson: buildSnapshotPayload(snapshot)
  });
}

export async function deleteNativeVaultSnapshot(localVaultId: string) {
  if (!supportsNativeVaultStore()) {
    return;
  }

  await invoke("native_vault_store_delete", {
    localVaultId
  }).catch(() => undefined);
}
