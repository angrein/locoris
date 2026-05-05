import {
  listPersistentKeys,
  readPersistentString,
  removePersistentString,
  writePersistentString
} from "./persistentClientStorage";

const vaultPassphraseCache = new Map<string, string>();
const VAULT_PERSISTENT_STORAGE_PREFIX = "zen-notes.vault-passphrase:";

function normalizeLocalVaultId(localVaultId: string) {
  return localVaultId.trim();
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function buildPersistentStorageKey(localVaultId: string) {
  return `${VAULT_PERSISTENT_STORAGE_PREFIX}${localVaultId}`;
}

function readPersistedPassphrase(localVaultId: string) {
  try {
    return readPersistentString(buildPersistentStorageKey(localVaultId));
  } catch {
    return null;
  }
}

function persistPassphrase(localVaultId: string, passphrase: string) {
  try {
    writePersistentString(buildPersistentStorageKey(localVaultId), passphrase);
  } catch {
    // If the browser blocks localStorage, we keep the in-memory session only.
  }
}

function removePersistedPassphrase(localVaultId: string) {
  try {
    removePersistentString(buildPersistentStorageKey(localVaultId));
  } catch {
    // Ignore storage cleanup failures and keep the app usable.
  }
}

function readLegacySessionPassphrase(localVaultId: string) {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(buildPersistentStorageKey(localVaultId));
  } catch {
    return null;
  }
}

function removeLegacySessionPassphrase(localVaultId: string) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(buildPersistentStorageKey(localVaultId));
  } catch {
    // Ignore storage cleanup failures and keep the app usable.
  }
}

export function unlockVaultEncryptionSession(localVaultId: string, passphrase: string) {
  const normalizedLocalVaultId = normalizeLocalVaultId(localVaultId);

  if (!normalizedLocalVaultId) {
    throw new Error("LOCAL_VAULT_ID_REQUIRED");
  }

  vaultPassphraseCache.set(normalizedLocalVaultId, passphrase);
  persistPassphrase(normalizedLocalVaultId, passphrase);
  removeLegacySessionPassphrase(normalizedLocalVaultId);
}

export function lockVaultEncryptionSession(localVaultId: string) {
  const normalizedLocalVaultId = normalizeLocalVaultId(localVaultId);
  vaultPassphraseCache.delete(normalizedLocalVaultId);
  removePersistedPassphrase(normalizedLocalVaultId);
  removeLegacySessionPassphrase(normalizedLocalVaultId);
}

export function hasVaultEncryptionSession(localVaultId: string) {
  return getVaultEncryptionSessionPassphrase(localVaultId) !== null;
}

export function getVaultEncryptionSessionPassphrase(localVaultId: string) {
  const normalizedLocalVaultId = normalizeLocalVaultId(localVaultId);

  if (!normalizedLocalVaultId) {
    return null;
  }

  const cachedPassphrase = vaultPassphraseCache.get(normalizedLocalVaultId);

  if (cachedPassphrase !== undefined) {
    return cachedPassphrase;
  }

  const persistedPassphrase = readPersistedPassphrase(normalizedLocalVaultId);

  if (persistedPassphrase) {
    vaultPassphraseCache.set(normalizedLocalVaultId, persistedPassphrase);
    return persistedPassphrase;
  }

  const legacySessionPassphrase = readLegacySessionPassphrase(normalizedLocalVaultId);

  if (!legacySessionPassphrase) {
    return null;
  }

  vaultPassphraseCache.set(normalizedLocalVaultId, legacySessionPassphrase);
  persistPassphrase(normalizedLocalVaultId, legacySessionPassphrase);
  removeLegacySessionPassphrase(normalizedLocalVaultId);
  return legacySessionPassphrase;
}

export function clearVaultEncryptionSessions() {
  vaultPassphraseCache.clear();

  try {
    listPersistentKeys(VAULT_PERSISTENT_STORAGE_PREFIX).forEach((key) => {
      removePersistentString(key);
    });
  } catch {
    // Ignore storage cleanup failures and keep the app usable.
  }

  if (canUseSessionStorage()) {
    try {
      const keysToRemove: string[] = [];

      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);

        if (key?.startsWith(VAULT_PERSISTENT_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        window.sessionStorage.removeItem(key);
      });
    } catch {
      // Ignore storage cleanup failures and keep the app usable.
    }
  }
}
