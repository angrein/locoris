import { isTauri } from "@tauri-apps/api/core";

const STORE_FILE_NAME = "settings/locoris-client.store.json";
const MIGRATION_PREFIXES = ["zen-notes.", "zen:"];

const memoryStorage = new Map<string, string>();

let desktopStorePromise: Promise<Awaited<ReturnType<typeof import("@tauri-apps/plugin-store")["load"]>> | null> | null =
  null;
let initializationPromise: Promise<void> | null = null;
let desktopStoreActive = false;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function shouldManageStorageKey(key: string) {
  return MIGRATION_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function seedMemoryFromBrowserStorage() {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);

      if (!key || !shouldManageStorageKey(key)) {
        continue;
      }

      const value = window.localStorage.getItem(key);

      if (value !== null) {
        memoryStorage.set(key, value);
      }
    }
  } catch {
    // Ignore browser storage read failures and keep the app usable.
  }
}

async function getDesktopStore() {
  if (!isTauri()) {
    return null;
  }

  if (!desktopStorePromise) {
    desktopStorePromise = (async () => {
      const { load } = await import("@tauri-apps/plugin-store");
      return load(STORE_FILE_NAME, { defaults: {}, autoSave: 200 });
    })();
  }

  return desktopStorePromise;
}

export async function initializePersistentClientStorage() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    seedMemoryFromBrowserStorage();

    const desktopStore = await getDesktopStore().catch(() => null);

    if (!desktopStore) {
      desktopStoreActive = false;
      return;
    }

    desktopStoreActive = true;

    try {
      const keys = await desktopStore.keys();

      for (const key of keys) {
        const value = await desktopStore.get<string>(key);

        if (typeof value === "string") {
          memoryStorage.set(key, value);
        }
      }

      if (canUseBrowserStorage()) {
        let migrated = false;

        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index);

          if (!key || !shouldManageStorageKey(key) || memoryStorage.has(key)) {
            continue;
          }

          const value = window.localStorage.getItem(key);

          if (value === null) {
            continue;
          }

          memoryStorage.set(key, value);
          await desktopStore.set(key, value);
          migrated = true;
        }

        if (migrated) {
          await desktopStore.save();
        }
      }
    } catch {
      desktopStoreActive = false;
      seedMemoryFromBrowserStorage();
    }
  })();

  return initializationPromise;
}

export function isDesktopPersistentStorageActive() {
  return desktopStoreActive;
}

export function readPersistentString(key: string) {
  if (!key) {
    return null;
  }

  const cached = memoryStorage.get(key);

  if (typeof cached === "string") {
    return cached;
  }

  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (raw !== null && shouldManageStorageKey(key)) {
      memoryStorage.set(key, raw);
    }

    return raw;
  } catch {
    return null;
  }
}

export function writePersistentString(key: string, value: string) {
  if (!key) {
    return;
  }

  memoryStorage.set(key, value);

  if (desktopStoreActive) {
    void getDesktopStore()
      .then(async (desktopStore) => {
        if (!desktopStore) {
          return;
        }

        await desktopStore.set(key, value);
        await desktopStore.save();
      })
      .catch(() => {
        // Ignore desktop store write failures and keep the app usable.
      });

    return;
  }

  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore browser storage failures and keep the app usable.
  }
}

export function removePersistentString(key: string) {
  if (!key) {
    return;
  }

  memoryStorage.delete(key);

  if (desktopStoreActive) {
    void getDesktopStore()
      .then(async (desktopStore) => {
        if (!desktopStore) {
          return;
        }

        await desktopStore.delete(key);
        await desktopStore.save();
      })
      .catch(() => {
        // Ignore desktop store cleanup failures and keep the app usable.
      });

    return;
  }

  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore browser storage cleanup failures and keep the app usable.
  }
}

export function listPersistentKeys(prefix?: string) {
  return [...memoryStorage.keys()].filter((key) => (prefix ? key.startsWith(prefix) : true));
}
