import {
  listPersistentKeys,
  readPersistentString,
  removePersistentString
} from "./persistentClientStorage";
import {
  buildVaultEncryptionSessionSecretKey,
  deleteSecureSecret,
  preloadSecureSecrets,
  readCachedSecureSecret,
  readSecureSecret,
  writeSecureSecret
} from "./secureSecretStore";

const VAULT_PERSISTENT_STORAGE_PREFIX = "zen-notes.vault-passphrase:";

function normalizeLocalVaultId(localVaultId: string) {
  return localVaultId.trim();
}

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function buildLegacyStorageKey(localVaultId: string) {
  return `${VAULT_PERSISTENT_STORAGE_PREFIX}${localVaultId}`;
}

function readLegacyPersistentPassphrase(localVaultId: string) {
  try {
    return readPersistentString(buildLegacyStorageKey(localVaultId));
  } catch {
    return null;
  }
}

function readLegacySessionPassphrase(localVaultId: string) {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(buildLegacyStorageKey(localVaultId));
  } catch {
    return null;
  }
}

function removeLegacySessionPassphrase(localVaultId: string) {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(buildLegacyStorageKey(localVaultId));
  } catch {
    // Ignore storage cleanup failures and keep the app usable.
  }
}

function clearLegacyPersistentPassphrase(localVaultId: string) {
  try {
    removePersistentString(buildLegacyStorageKey(localVaultId));
  } catch {
    // Ignore storage cleanup failures and keep the app usable.
  }
}

export async function initializeVaultEncryptionSessions(localVaultIds: readonly string[]) {
  const normalizedLocalVaultIds = [...new Set(localVaultIds.map((localVaultId) => localVaultId.trim()).filter(Boolean))];

  for (const localVaultId of normalizedLocalVaultIds) {
    const secureKey = buildVaultEncryptionSessionSecretKey(localVaultId);
    const secureValue = await readSecureSecret(secureKey);

    if (!secureValue) {
      const migratedValue =
        readLegacyPersistentPassphrase(localVaultId)?.trim() ||
        readLegacySessionPassphrase(localVaultId)?.trim() ||
        "";

      if (migratedValue) {
        await writeSecureSecret(secureKey, migratedValue);
      }
    }

    clearLegacyPersistentPassphrase(localVaultId);
    removeLegacySessionPassphrase(localVaultId);
  }

  await preloadSecureSecrets(
    normalizedLocalVaultIds.map((localVaultId) => buildVaultEncryptionSessionSecretKey(localVaultId))
  );
}

export async function unlockVaultEncryptionSession(localVaultId: string, passphrase: string) {
  const normalizedLocalVaultId = normalizeLocalVaultId(localVaultId);

  if (!normalizedLocalVaultId) {
    throw new Error("LOCAL_VAULT_ID_REQUIRED");
  }

  await writeSecureSecret(
    buildVaultEncryptionSessionSecretKey(normalizedLocalVaultId),
    passphrase
  );
}

export async function lockVaultEncryptionSession(localVaultId: string) {
  const normalizedLocalVaultId = normalizeLocalVaultId(localVaultId);

  if (!normalizedLocalVaultId) {
    return;
  }

  clearLegacyPersistentPassphrase(normalizedLocalVaultId);
  removeLegacySessionPassphrase(normalizedLocalVaultId);
  await deleteSecureSecret(buildVaultEncryptionSessionSecretKey(normalizedLocalVaultId));
}

export function hasVaultEncryptionSession(localVaultId: string) {
  return getVaultEncryptionSessionPassphrase(localVaultId) !== null;
}

export function getVaultEncryptionSessionPassphrase(localVaultId: string) {
  const normalizedLocalVaultId = normalizeLocalVaultId(localVaultId);

  if (!normalizedLocalVaultId) {
    return null;
  }

  const cachedPassphrase = readCachedSecureSecret(
    buildVaultEncryptionSessionSecretKey(normalizedLocalVaultId)
  );

  return cachedPassphrase || null;
}

export async function clearVaultEncryptionSessions(localVaultIds: readonly string[]) {
  const normalizedLocalVaultIds = [...new Set(localVaultIds.map((localVaultId) => localVaultId.trim()).filter(Boolean))];

  await Promise.all(
    normalizedLocalVaultIds.map((localVaultId) =>
      deleteSecureSecret(buildVaultEncryptionSessionSecretKey(localVaultId))
    )
  );

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
