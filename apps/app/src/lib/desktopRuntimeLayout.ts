import type { DataStoreIdentifier } from "@tauri-apps/api/app";

export const DESKTOP_DATA_DIRECTORY = "data";
export const DESKTOP_SETTINGS_DIRECTORY = "settings";
export const DESKTOP_WEBVIEW_DIRECTORY = "webview";
export const DESKTOP_CACHE_DIRECTORY = "cache";
export const DESKTOP_NATIVE_VAULT_DIRECTORY = `${DESKTOP_DATA_DIRECTORY}/vaults`;
export const DESKTOP_VAULT_BACKUP_DIRECTORY = `${DESKTOP_DATA_DIRECTORY}/backups/vaults`;

function fnv1a32(input: string, seed: number) {
  let hash = seed >>> 0;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

function u32ToBytes(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

export function sanitizeRuntimeVersionToken(version: string) {
  const trimmed = version.trim();

  if (!trimmed) {
    return "dev";
  }

  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildDesktopRuntimeVersionToken(identifier: string, version: string) {
  const normalizedIdentifier = identifier.trim() || "com.locoris.desktop";
  const normalizedVersion = sanitizeRuntimeVersionToken(version);
  return `${normalizedIdentifier}-${normalizedVersion}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildWindowsWebviewDirectory(label: string, identifier: string, version: string) {
  const normalizedLabel = label.trim() || "main";
  return `${DESKTOP_WEBVIEW_DIRECTORY}/${normalizedLabel}/${buildDesktopRuntimeVersionToken(identifier, version)}`;
}

export function buildMacosDataStoreIdentifier(identifier: string, version: string): DataStoreIdentifier {
  const seedSource = `${identifier.trim() || "com.locoris.desktop"}@${sanitizeRuntimeVersionToken(version)}`;
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  const bytes = seeds.flatMap((seed, index) => u32ToBytes(fnv1a32(`${index}:${seedSource}`, seed)));
  return bytes.slice(0, 16) as DataStoreIdentifier;
}

export function buildNativeVaultDatabaseRelativePath(localVaultId: string) {
  const sanitizedVaultId = localVaultId.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "local-default";
  return `${DESKTOP_NATIVE_VAULT_DIRECTORY}/${sanitizedVaultId}.sqlite3`;
}
