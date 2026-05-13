import { invoke, isTauri } from "@tauri-apps/api/core";

import {
  isDesktopPersistentStorageActive,
  readPersistentString,
  removePersistentString,
  writePersistentString
} from "./persistentClientStorage";
import type {
  AppSettings,
  SyncConnection,
  SyncVaultBinding
} from "../types";

const secureSecretCache = new Map<string, string>();
const loadedSecureSecretKeys = new Set<string>();
const secureSecretListeners = new Set<() => void>();
const SECURE_SECRET_FALLBACK_PREFIX = "zen-notes.secure-secret-fallback:";

export const APP_SETTINGS_SECRET_FIELDS = [
  "selfHostedToken",
  "hostedSessionToken",
  "hostedSyncToken"
] as const satisfies readonly (keyof AppSettings)[];

export const SYNC_CONNECTION_SECRET_FIELDS = [
  "managementToken",
  "sessionToken",
  "refreshToken"
] as const;

export const SYNC_BINDING_SECRET_FIELDS = [
  "syncToken"
] as const satisfies readonly (keyof SyncVaultBinding)[];

export type AppSettingsSecretField = (typeof APP_SETTINGS_SECRET_FIELDS)[number];
export type SyncConnectionSecretField = (typeof SYNC_CONNECTION_SECRET_FIELDS)[number];
export type SyncBindingSecretField = (typeof SYNC_BINDING_SECRET_FIELDS)[number];

function isDesktopSecureRuntime() {
  return typeof window !== "undefined" && isTauri();
}

function normalizeSecretValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSecureSecretFallbackKey(key: string) {
  return `${SECURE_SECRET_FALLBACK_PREFIX}${key.trim()}`;
}

function canUseDesktopSecretFallback() {
  return isDesktopPersistentStorageActive();
}

function readDesktopSecretFallback(key: string) {
  if (!canUseDesktopSecretFallback()) {
    return "";
  }

  return normalizeSecretValue(readPersistentString(buildSecureSecretFallbackKey(key)));
}

function writeDesktopSecretFallback(key: string, value: string) {
  if (!canUseDesktopSecretFallback()) {
    return;
  }

  const storageKey = buildSecureSecretFallbackKey(key);

  if (value) {
    writePersistentString(storageKey, value);
    return;
  }

  removePersistentString(storageKey);
}

function notifySecureSecretListeners() {
  secureSecretListeners.forEach((listener) => listener());
}

async function readNativeSecureSecret(key: string) {
  if (!isDesktopSecureRuntime()) {
    return null;
  }

  return invoke<string | null>("secure_secret_get", {
    key
  });
}

async function writeNativeSecureSecret(key: string, value: string) {
  if (!isDesktopSecureRuntime()) {
    return;
  }

  if (!value) {
    await invoke("secure_secret_delete", {
      key
    });
    return;
  }

  await invoke("secure_secret_set", {
    key,
    value
  });
}

async function ensureSecureSecretLoaded(key: string) {
  const normalizedKey = key.trim();

  if (!normalizedKey) {
    return "";
  }

  if (loadedSecureSecretKeys.has(normalizedKey)) {
    return secureSecretCache.get(normalizedKey) ?? "";
  }

  const nativeValue = normalizeSecretValue(await readNativeSecureSecret(normalizedKey));
  const fallbackValue = readDesktopSecretFallback(normalizedKey);
  const resolvedValue = nativeValue || fallbackValue;
  loadedSecureSecretKeys.add(normalizedKey);

  if (resolvedValue) {
    secureSecretCache.set(normalizedKey, resolvedValue);
  } else {
    secureSecretCache.delete(normalizedKey);
  }

  if (nativeValue && !fallbackValue) {
    writeDesktopSecretFallback(normalizedKey, nativeValue);
  }

  if (!nativeValue && fallbackValue && isDesktopSecureRuntime()) {
    void writeNativeSecureSecret(normalizedKey, fallbackValue).catch(() => {
      // Keep the fallback copy in the desktop store even if the native secure backend is unavailable.
    });
  }

  return resolvedValue;
}

function setCachedSecureSecret(key: string, value: string) {
  const normalizedKey = key.trim();

  if (!normalizedKey) {
    return;
  }

  loadedSecureSecretKeys.add(normalizedKey);

  if (value) {
    secureSecretCache.set(normalizedKey, value);
  } else {
    secureSecretCache.delete(normalizedKey);
  }

  notifySecureSecretListeners();
}

export function subscribeSecureSecretChanges(listener: () => void) {
  secureSecretListeners.add(listener);

  return () => {
    secureSecretListeners.delete(listener);
  };
}

export function readCachedSecureSecret(key: string) {
  return secureSecretCache.get(key.trim()) ?? "";
}

export async function preloadSecureSecrets(keys: readonly string[]) {
  const normalizedKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  await Promise.all(normalizedKeys.map((key) => ensureSecureSecretLoaded(key)));
}

export async function readSecureSecret(key: string) {
  return ensureSecureSecretLoaded(key);
}

export async function writeSecureSecret(key: string, value: string) {
  const normalizedKey = key.trim();
  const normalizedValue = normalizeSecretValue(value);

  if (!normalizedKey) {
    return;
  }

  setCachedSecureSecret(normalizedKey, normalizedValue);
  writeDesktopSecretFallback(normalizedKey, normalizedValue);

  if (!isDesktopSecureRuntime()) {
    return;
  }

  try {
    await writeNativeSecureSecret(normalizedKey, normalizedValue);
  } catch (error) {
    if (!canUseDesktopSecretFallback()) {
      throw error;
    }
  }
}

export async function deleteSecureSecret(key: string) {
  const normalizedKey = key.trim();

  if (!normalizedKey) {
    return;
  }

  setCachedSecureSecret(normalizedKey, "");
  writeDesktopSecretFallback(normalizedKey, "");

  if (!isDesktopSecureRuntime()) {
    return;
  }

  try {
    await writeNativeSecureSecret(normalizedKey, "");
  } catch (error) {
    if (!canUseDesktopSecretFallback()) {
      throw error;
    }
  }
}

export function buildAppSettingsSecretKey(
  localVaultId: string,
  field: AppSettingsSecretField
) {
  return `vault:${localVaultId.trim()}:settings:${field}`;
}

export function buildSyncConnectionSecretKey(
  connectionId: string,
  field: SyncConnectionSecretField
) {
  return `sync-connection:${connectionId.trim()}:${field}`;
}

export function buildSyncBindingSecretKey(
  bindingId: string,
  field: SyncBindingSecretField
) {
  return `sync-binding:${bindingId.trim()}:${field}`;
}

export function buildVaultEncryptionSessionSecretKey(localVaultId: string) {
  return `vault:${localVaultId.trim()}:encryption-session`;
}

export function listAppSettingsSecretKeys(localVaultId: string) {
  return APP_SETTINGS_SECRET_FIELDS.map((field) => buildAppSettingsSecretKey(localVaultId, field));
}

export function listSyncConnectionSecretKeys(connectionId: string) {
  return SYNC_CONNECTION_SECRET_FIELDS.map((field) => buildSyncConnectionSecretKey(connectionId, field));
}

export function listSyncBindingSecretKeys(bindingId: string) {
  return SYNC_BINDING_SECRET_FIELDS.map((field) => buildSyncBindingSecretKey(bindingId, field));
}

export async function hydrateAppSettingsSecrets(
  localVaultId: string,
  settings: AppSettings | null
): Promise<AppSettings | null> {
  if (!settings) {
    return null;
  }

  const [selfHostedToken, hostedSessionToken, hostedSyncToken] = await Promise.all(
    APP_SETTINGS_SECRET_FIELDS.map((field) =>
      readSecureSecret(buildAppSettingsSecretKey(localVaultId, field))
    )
  );

  return {
    ...settings,
    selfHostedToken,
    hostedSessionToken,
    hostedSyncToken
  };
}

export function hydrateCachedSyncConnection(connection: SyncConnection): SyncConnection {
  return {
    ...connection,
    managementToken: readCachedSecureSecret(
      buildSyncConnectionSecretKey(connection.id, "managementToken")
    ),
    sessionToken: readCachedSecureSecret(
      buildSyncConnectionSecretKey(connection.id, "sessionToken")
    )
  };
}

export function hydrateCachedSyncBinding(binding: SyncVaultBinding): SyncVaultBinding {
  return {
    ...binding,
    syncToken: readCachedSecureSecret(
      buildSyncBindingSecretKey(binding.id, "syncToken")
    )
  };
}

export async function clearAppSettingsSecrets(localVaultId: string) {
  await Promise.all(
    APP_SETTINGS_SECRET_FIELDS.map((field) =>
      deleteSecureSecret(buildAppSettingsSecretKey(localVaultId, field))
    )
  );
}

export async function clearSyncConnectionSecrets(connectionId: string) {
  await Promise.all(
    SYNC_CONNECTION_SECRET_FIELDS.map((field) =>
      deleteSecureSecret(buildSyncConnectionSecretKey(connectionId, field))
    )
  );
}

export async function clearSyncBindingSecrets(bindingId: string) {
  await Promise.all(
    SYNC_BINDING_SECRET_FIELDS.map((field) =>
      deleteSecureSecret(buildSyncBindingSecretKey(bindingId, field))
    )
  );
}
